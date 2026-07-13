"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { validarCartao } from "@/lib/cartao";
import { getGateway } from "@/lib/gateway";
import { calcularValorMensal } from "@/lib/precos";
import { normalizarCnpj } from "@/lib/validators";

// Ativa cobrança recorrente pra contas TRIAL que não passaram pelo signup
// novo (Regina 13/07). Cliente vem do link "/conta/completar-cadastro"
// enviado no WA quando trial está expirando/expirou.
export type CompletarResult = {
  erro?: string;
  campos?: Partial<Record<string, string>>;
  ok?: boolean;
};

export async function completarCadastroAction(
  _p: CompletarResult | null,
  formData: FormData,
): Promise<CompletarResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: { empresas: { take: 1 }, usuarios: { take: 1 } },
  });
  if (!conta) return { erro: "Conta não encontrada." };
  if (conta.gatewaySubscriptionId) redirect("/dashboard");

  const empresa = conta.empresas[0];
  const usuarioConta = conta.usuarios[0];
  if (!empresa || !usuarioConta) return { erro: "Cadastre uma empresa primeiro." };

  // Extrai + valida cartão
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
      nome: "cartaoNome",
      validade: "cartaoValidade",
      cvv: "cartaoCvv",
    };
    return {
      erro: `Cartão inválido: ${cartao.mensagem}`,
      campos: { [campoMap[cartao.campo]]: cartao.mensagem },
    };
  }

  const cpfTitularRaw = String(formData.get("cpfTitularCartao") || "").replace(/\D/g, "");
  if (cpfTitularRaw.length !== 11) {
    return { erro: "CPF do titular inválido.", campos: { cpfTitularCartao: "11 dígitos" } };
  }

  const diaVencRaw = String(formData.get("diaVencimento") || "");
  if (!["10", "15", "20"].includes(diaVencRaw)) {
    return { erro: "Escolha um dia de vencimento.", campos: { diaVencimento: "Obrigatório" } };
  }
  const diaVenc = Number(diaVencRaw);

  // Calcula nextDueDate = próximo dia {10|15|20} APÓS trialAteEm (ou hoje se trial já expirou)
  const base = conta.trialAteEm && conta.trialAteEm > new Date() ? conta.trialAteEm : new Date();
  const nextDueDate = new Date(base);
  nextDueDate.setDate(diaVenc);
  if (nextDueDate <= base) {
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  }

  try {
    const gateway = await getGateway();
    if (!gateway.criarAssinatura) {
      return { erro: "Gateway não configurado para assinatura recorrente." };
    }

    const breakdown = await calcularValorMensal(conta.id, conta.plano);

    // Cria customer se ainda não tem
    let customerId = conta.gatewayCustomerId;
    if (!customerId) {
      const c = await gateway.criarCliente({
        contaId: conta.id,
        nome: empresa.razaoSocial,
        email: usuarioConta.email,
        cpfCnpj: normalizarCnpj(empresa.cnpj),
        telefone: empresa.telefones,
        endereco: empresa.endereco,
      });
      customerId = c.customerId;
    }

    // Cria cobrança interna referente ao primeiro mes
    const competencia = `${nextDueDate.getFullYear()}-${String(nextDueDate.getMonth() + 1).padStart(2, "0")}`;
    const cobrancaInterna = await prisma.cobranca.create({
      data: {
        contaId: conta.id,
        competencia,
        plano: conta.plano,
        forma: "CARTAO_CREDITO",
        valor: breakdown.valorTotal,
        vencimento: nextDueDate,
        status: "PENDENTE",
      },
    });

    const sub = await gateway.criarAssinatura({
      customerId,
      cobrancaIdInterno: cobrancaInterna.id,
      valor: breakdown.valorTotal,
      proximoVencimento: nextDueDate,
      descricao: `CP System — Plano ${conta.plano} (${competencia})`,
      cartao: {
        numero: cartaoInput.numero,
        nome: cartaoInput.nome,
        validadeMes: cartao.validadeMes,
        validadeAno: cartao.validadeAno,
        cvv: cartaoInput.cvv,
      },
      titular: {
        nome: cartaoInput.nome,
        email: usuarioConta.email,
        cpfCnpj: cpfTitularRaw,
        telefone: empresa.telefones || undefined,
        cep: empresa.cep || undefined,
        numeroEndereco: empresa.endereco.match(/,\s*(\d+[A-Za-z]?)\b/)?.[1] || "S/N",
      },
    });

    await prisma.conta.update({
      where: { id: conta.id },
      data: {
        gatewayCustomerId: customerId,
        gatewaySubscriptionId: sub.subscriptionId,
        gatewayProvider: gateway.nome,
        diaVencimento: diaVenc,
        cpfTitularCartao: cpfTitularRaw,
        proximoVencimento: nextDueDate,
      },
    });

    await prisma.cobranca.update({
      where: { id: cobrancaInterna.id },
      data: {
        gatewayChargeId: sub.primeiraCobranca.chargeId,
        gatewayInvoiceUrl: sub.primeiraCobranca.invoiceUrl || null,
        status: sub.primeiraCobranca.status,
      },
    });

    // Salva método de pagamento local (só últimos 4)
    // Desativa cartões antigos + cria novo como padrão
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
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao ativar cobrança no gateway." };
  }

  redirect("/dashboard?completou=1");
}
