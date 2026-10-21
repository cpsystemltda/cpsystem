"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { getGateway } from "@/lib/gateway";
import { validarCartao } from "@/lib/cartao";
import { calcularValorMensal } from "@/lib/precos";
import { traduzirErroGateway } from "@/lib/pagamentoAnalista";

/**
 * O cliente troca como paga a assinatura (Regina 24/08).
 *
 * A tela de assinatura mostrava o cartão salvo e mais nada: não havia caminho
 * pra trocar de cartão nem pra sair do cartão e passar a pagar por PIX/boleto.
 * Quem quisesse mudar tinha que falar com a gente.
 *
 * Como funciona cada caminho:
 * - CARTÃO: cria uma assinatura nova no gateway com o cartão informado e
 *   cancela a anterior. O gateway passa a cobrar sozinho todo mês.
 * - PIX/BOLETO: cancela a assinatura recorrente (se houver). A partir daí a
 *   renovação mensal gera a fatura no dia de vencimento escolhido, e o cliente
 *   paga pelo código na tela.
 */
export type ResultadoFormaPagamento = {
  ok?: true;
  mensagem?: string;
  erro?: string;
  campos?: Record<string, string>;
};

export async function trocarFormaPagamentoAction(
  _prev: ResultadoFormaPagamento | null,
  formData: FormData,
): Promise<ResultadoFormaPagamento> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Só quem administra a conta pode trocar a forma de pagamento." };
  }

  const forma = String(formData.get("forma") || "");
  if (!["PIX", "BOLETO", "CARTAO_CREDITO"].includes(forma)) {
    return { erro: "Escolha uma forma de pagamento." };
  }

  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: { empresas: { take: 1 }, usuarios: { take: 1 } },
  });
  if (!conta) return { erro: "Conta não encontrada." };
  const empresa = conta.empresas[0];
  if (!empresa) return { erro: "Cadastre uma empresa antes de configurar o pagamento." };

  const gateway = await getGateway();

  // === PIX / BOLETO: sai da recorrência automática ===
  if (forma !== "CARTAO_CREDITO") {
    if (conta.gatewaySubscriptionId && gateway.cancelarAssinatura) {
      try {
        await gateway.cancelarAssinatura(conta.gatewaySubscriptionId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Assinatura já removida no gateway não impede seguir.
        if (!msg.includes("404") && !msg.toLowerCase().includes("not found")) {
          return { erro: traduzirErroGateway(msg) };
        }
      }
    }
    await prisma.conta.update({
      where: { id: conta.id },
      data: { gatewaySubscriptionId: null },
    });
    await prisma.metodoPagamento.updateMany({
      where: { contaId: conta.id, padrao: true },
      data: { padrao: false },
    });

    await registrarAuditoria({
      contaId: conta.id,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Conta",
      recursoId: conta.id,
      resumo: `Passou a pagar a assinatura por ${forma === "PIX" ? "PIX" : "boleto"}`,
    });

    revalidatePath("/conta/assinatura");
    return {
      ok: true,
      mensagem:
        forma === "PIX"
          ? "Pronto. A cobrança no cartão foi encerrada e, a cada mês, o código PIX aparece aqui na tela — a confirmação é imediata."
          : "Pronto. A cobrança no cartão foi encerrada e, a cada mês, o boleto fica disponível aqui na tela, com 2 dias de prazo.",
    };
  }

  // === CARTÃO: assinatura nova, cartão novo ===
  const cartaoInput = {
    numero: String(formData.get("cartaoNumero") || "").replace(/\s/g, ""),
    nome: String(formData.get("cartaoNome") || ""),
    validade: String(formData.get("cartaoValidade") || ""),
    cvv: String(formData.get("cartaoCvv") || ""),
  };
  const cartao = validarCartao(cartaoInput);
  if (!cartao.ok) {
    const campoMap: Record<string, string> = {
      numero: "cartaoNumero",
      validade: "cartaoValidade",
      cvv: "cartaoCvv",
      nome: "cartaoNome",
    };
    return { erro: `Cartão inválido: ${cartao.mensagem}`, campos: { [campoMap[cartao.campo]]: cartao.mensagem } };
  }

  const cpfTitular = String(formData.get("cpfTitularCartao") || "").replace(/\D/g, "");
  if (cpfTitular.length !== 11) {
    return { erro: "CPF do titular inválido.", campos: { cpfTitularCartao: "11 dígitos" } };
  }

  if (!gateway.criarAssinatura) return { erro: "Gateway não suporta cobrança recorrente." };

  // Duplo clique (21/10/2026: o mesmo cartão foi enviado duas vezes em 30
  // segundos e nasceram duas assinaturas, uma cancelando a outra). O mesmo
  // final de cartão cadastrado há instantes é a mesma intenção: nada a fazer.
  const repetido = await prisma.metodoPagamento.findFirst({
    where: {
      contaId: conta.id,
      ultimosDigitos: cartao.ultimos4,
      ativo: true,
      criadoEm: { gte: new Date(Date.now() - 5 * 60_000) },
    },
    select: { id: true },
  });
  if (repetido) {
    revalidatePath("/conta/assinatura");
    return { ok: true, mensagem: `Cartão ${cartao.bandeira} final ${cartao.ultimos4} já cadastrado há instantes. A cobrança mensal sai nele.` };
  }

  try {
    const breakdown = await calcularValorMensal(conta.id, conta.plano);
    const { garantirCustomer } = await import("@/app/actions/assinatura");
    const { customerId } = await garantirCustomer(conta.id);

    const titular = {
      nome: cartaoInput.nome,
      email: conta.usuarios[0]?.email ?? usuario.email,
      cpfCnpj: cpfTitular,
      telefone: empresa.telefones || undefined,
      cep: empresa.cep || undefined,
      numeroEndereco: empresa.endereco.match(/,\s*(\d+[A-Za-z]?)\b/)?.[1] || "S/N",
    };
    const cartaoParaCobrar = {
      numero: cartaoInput.numero,
      nome: cartaoInput.nome,
      validadeMes: cartao.validadeMes,
      validadeAno: cartao.validadeAno,
      cvv: cartaoInput.cvv,
    };

    // Fatura em aberto vem ANTES da troca (Regina, 21/10/2026). Trocar o
    // cartão com fatura vencida criava assinatura nova e cancelava a antiga,
    // e o Asaas apagava a fatura junto: a dívida sumia, o cliente pagava o
    // mês seguinte achando que era o atual, e o analista recebia aviso do
    // mês errado. Agora a fatura vencida (ou que vence hoje) é cobrada neste
    // cartão primeiro. Se a operadora recusar, a troca não acontece e o
    // cliente sabe na hora o que fazer.
    const fimDeHoje = new Date();
    fimDeHoje.setHours(23, 59, 59, 999);
    const emAberto = await prisma.cobranca.findMany({
      where: {
        contaId: conta.id,
        gatewayChargeId: { not: null },
        OR: [{ status: "ATRASADA" }, { status: "PENDENTE", vencimento: { lte: fimDeHoje } }],
      },
      select: { id: true, gatewayChargeId: true, valor: true, competencia: true },
      orderBy: { vencimento: "asc" },
    });
    if (emAberto.length > 0 && gateway.pagarCobrancaComCartao) {
      for (const c of emAberto) {
        try {
          const pago = await gateway.pagarCobrancaComCartao({
            chargeId: c.gatewayChargeId!,
            cartao: cartaoParaCobrar,
            titular,
          });
          if (pago.status !== "PAGA") throw new Error(`cobrança ficou ${pago.status}`);
          await prisma.cobranca.update({
            where: { id: c.id },
            data: { forma: "CARTAO_CREDITO", observacoes: `Fatura em aberto quitada no cartão novo (final ${cartao.ultimos4}) na troca de cartão` },
          });
        } catch (e) {
          console.error("[forma-pagamento] fatura em aberto recusada no cartão novo:", e);
          const valorBr = Number(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          return {
            erro:
              `A fatura em aberto de ${valorBr} (${c.competencia}) não foi aceita neste cartão pela operadora. ` +
              `O cartão não foi trocado. Pague a fatura por PIX nesta tela ou confira os dados com a operadora e tente novamente.`,
          };
        }
      }
    }

    // Próxima cobrança: o vencimento já combinado se ainda está à frente;
    // senão, o dia escolhido no mês que vem (ou daqui a 30 dias, sem dia
    // escolhido). A fatura em aberto já foi tratada acima, então a assinatura
    // nova começa no mês seguinte, e não repete o mês que acabou de ser pago.
    const agora = new Date();
    let proximo: Date;
    if (conta.proximoVencimento && conta.proximoVencimento > agora) {
      proximo = conta.proximoVencimento;
    } else if (conta.diaVencimento) {
      const d = new Date(agora.getFullYear(), agora.getMonth() + 1, Math.min(conta.diaVencimento, 28), 12, 0, 0);
      proximo = d;
    } else {
      proximo = new Date(Date.now() + 30 * 86400000);
    }

    const cobranca = await prisma.cobranca.create({
      data: {
        contaId: conta.id,
        competencia: `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, "0")}`,
        plano: conta.plano,
        forma: "CARTAO_CREDITO",
        valor: breakdown.valorTotal,
        vencimento: proximo,
        status: "PENDENTE",
        observacoes: "Troca de forma de pagamento — cartão",
      },
    });

    const sub = await gateway.criarAssinatura({
      customerId,
      cobrancaIdInterno: cobranca.id,
      valor: breakdown.valorTotal,
      proximoVencimento: proximo,
      descricao: `CP System — Plano ${conta.plano}`,
      cartao: cartaoParaCobrar,
      titular,
    });

    // Cancela a recorrência antiga só depois que a nova existe — se a ordem
    // fosse inversa e a criação falhasse, o cliente ficaria sem cobrança
    // nenhuma e ninguém perceberia até a fatura não chegar.
    if (conta.gatewaySubscriptionId && gateway.cancelarAssinatura) {
      await gateway
        .cancelarAssinatura(conta.gatewaySubscriptionId)
        .catch((e) => console.error("[forma-pagamento] falha ao cancelar assinatura antiga:", e));
    }

    await prisma.conta.update({
      where: { id: conta.id },
      data: {
        gatewaySubscriptionId: sub.subscriptionId,
        gatewayCustomerId: customerId,
        gatewayProvider: gateway.nome,
        cpfTitularCartao: cpfTitular,
      },
    });
    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        gatewayChargeId: sub.primeiraCobranca.chargeId,
        gatewayInvoiceUrl: sub.primeiraCobranca.invoiceUrl || null,
        status: sub.primeiraCobranca.status,
      },
    });

    await prisma.metodoPagamento.updateMany({
      where: { contaId: conta.id, padrao: true },
      data: { padrao: false },
    });
    await prisma.metodoPagamento.create({
      data: {
        contaId: conta.id,
        forma: "CARTAO_CREDITO",
        apelido: `${cartao.bandeira} final ${cartao.ultimos4}`,
        bandeira: cartao.bandeira,
        ultimosDigitos: cartao.ultimos4,
        validadeMes: cartao.validadeMes,
        validadeAno: cartao.validadeAno,
        // Token do cartao no gateway — e o que permite religar a
        // assinatura sem pedir o numero de novo (Regina 21/09/2026).
        gatewayTokenId: sub.creditCardToken ?? null,
        padrao: true,
        ativo: true,
      },
    });

    await registrarAuditoria({
      contaId: conta.id,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Conta",
      recursoId: conta.id,
      resumo: `Trocou o cartão da assinatura (${cartao.bandeira} final ${cartao.ultimos4})`,
    });

    revalidatePath("/conta/assinatura");
    return {
      ok: true,
      mensagem: `Cartão ${cartao.bandeira} final ${cartao.ultimos4} cadastrado. A cobrança mensal passa a sair nele.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[forma-pagamento] falha ao trocar pra cartão:", err);
    return { erro: traduzirErroGateway(msg) };
  }
}
