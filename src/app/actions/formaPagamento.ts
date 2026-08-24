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

  try {
    const breakdown = await calcularValorMensal(conta.id, conta.plano);
    // Próxima cobrança: mantém o vencimento já combinado; se não houver, joga
    // pro mês que vem no dia escolhido (ou daqui a 30 dias).
    const proximo =
      conta.proximoVencimento && conta.proximoVencimento > new Date()
        ? conta.proximoVencimento
        : new Date(Date.now() + 30 * 86400000);

    const { garantirCustomer } = await import("@/app/actions/assinatura");
    const { customerId } = await garantirCustomer(conta.id);

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
      cartao: {
        numero: cartaoInput.numero,
        nome: cartaoInput.nome,
        validadeMes: cartao.validadeMes,
        validadeAno: cartao.validadeAno,
        cvv: cartaoInput.cvv,
      },
      titular: {
        nome: cartaoInput.nome,
        email: conta.usuarios[0]?.email ?? usuario.email,
        cpfCnpj: cpfTitular,
        telefone: empresa.telefones || undefined,
        cep: empresa.cep || undefined,
        numeroEndereco: empresa.endereco.match(/,\s*(\d+[A-Za-z]?)\b/)?.[1] || "S/N",
      },
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
