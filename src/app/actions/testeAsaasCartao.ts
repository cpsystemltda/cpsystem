"use server";

// Teste de cobranca CARTAO DE CREDITO no Asaas com valor reduzido (R$ 10)
// simulando assinatura Premium (Regina 23/06).
//
// PCI-DSS: o numero do cartao NUNCA fica salvo no nosso banco. So vai
// pro Asaas via API. Salvamos so ultimos 4 digitos + bandeira em
// MetodoPagamento.

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { getGateway } from "@/lib/gateway";
import { prisma } from "@/lib/prisma";
import { detectarBandeira } from "@/lib/cartao";
import { ativarPlano } from "@/app/actions/assinatura";

export type ResultadoTesteCartao =
  | {
      ok: true;
      chargeId: string;
      status: string;
      invoiceUrl?: string;
      cartaoUltimos: string;
      cartaoBandeira: string;
      contaAtivada: boolean;
    }
  | { ok: false; erro: string };

export async function testarCobrancaCartaoAction(
  _prev: ResultadoTesteCartao | null,
  formData: FormData,
): Promise<ResultadoTesteCartao> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { ok: false, erro: "Apenas super admin." };

  const numero = String(formData.get("numero") || "").replace(/\s/g, "");
  const nome = String(formData.get("nome") || "").trim();
  const validadeMes = Number(formData.get("validadeMes") || 0);
  const validadeAno = Number(formData.get("validadeAno") || 0);
  const cvv = String(formData.get("cvv") || "").trim();

  if (!numero || numero.length < 13) return { ok: false, erro: "Número de cartão inválido." };
  if (!nome) return { ok: false, erro: "Nome do titular obrigatório." };
  if (!validadeMes || validadeMes < 1 || validadeMes > 12)
    return { ok: false, erro: "Mês de validade inválido." };
  if (!validadeAno || validadeAno < 2026) return { ok: false, erro: "Ano de validade inválido." };
  if (!cvv || cvv.length < 3) return { ok: false, erro: "CVV inválido." };

  const gateway = await getGateway();
  if (gateway.nome !== "ASAAS") return { ok: false, erro: "Gateway atual não é ASAAS." };

  const conta = usuario.conta;

  // Garante customer no Asaas
  let customerId = conta.gatewayCustomerId;
  if (!customerId) {
    const cliente = await gateway.criarCliente({
      contaId: conta.id,
      nome: usuario.nome || "Super Admin",
      email: usuario.email,
      cpfCnpj: conta.empresas[0]?.cnpj || "00000000000",
    });
    customerId = cliente.customerId;
    await prisma.conta.update({
      where: { id: conta.id },
      data: { gatewayCustomerId: customerId, gatewayProvider: "ASAAS" },
    });
  }

  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const vencimento = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  // Cobranca interna marcada como Plano PREMIUM (mesmo que valor seja 10)
  const cobranca = await prisma.cobranca.create({
    data: {
      contaId: conta.id,
      competencia,
      plano: "PREMIUM",
      forma: "CARTAO_CREDITO",
      valor: 10,
      status: "PENDENTE",
      vencimento,
      observacoes: "TESTE CARTAO — Premium R$ 10 (Regina 23/06)",
    },
  });

  try {
    const r = await gateway.criarCobranca({
      cobrancaIdInterno: cobranca.id,
      customerId,
      valor: 10,
      vencimento,
      descricao: "CP System — Plano PREMIUM (TESTE R$ 10)",
      forma: "CARTAO_CREDITO",
      cartao: { numero, nome, validadeMes, validadeAno, cvv },
    });

    const cobrancaAtualizada = await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        gatewayChargeId: r.chargeId,
        gatewayInvoiceUrl: r.invoiceUrl,
        status: r.status,
      },
    });

    const ultimos = numero.slice(-4);
    const bandeira = detectarBandeira(numero);
    await prisma.metodoPagamento.create({
      data: {
        contaId: conta.id,
        forma: "CARTAO_CREDITO",
        apelido: `${bandeira} final ${ultimos}`,
        bandeira,
        ultimosDigitos: ultimos,
        validadeMes,
        validadeAno,
        padrao: true,
      },
    });

    let contaAtivada = false;
    if (cobrancaAtualizada.status === "PAGA") {
      await ativarPlano(conta.id, "PREMIUM");
      contaAtivada = true;
    }

    return {
      ok: true,
      chargeId: r.chargeId,
      status: cobrancaAtualizada.status,
      invoiceUrl: r.invoiceUrl,
      cartaoUltimos: ultimos,
      cartaoBandeira: bandeira,
      contaAtivada,
    };
  } catch (e) {
    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: { status: "CANCELADA" },
    });
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
