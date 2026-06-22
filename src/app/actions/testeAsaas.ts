"use server";

// Cria uma cobranca PIX avulsa de R$ 10 pra validar a integracao Asaas
// end-to-end (Regina 22/06). NAO afeta assinatura — eh cobranca solta
// pra ver o ciclo: criar -> pagar -> webhook chega -> processa.
//
// Acessivel so pra super admin. Apos validar, esse arquivo pode ser
// removido — ou mantido como ferramenta de diagnostico.

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { getGateway } from "@/lib/gateway";
import { prisma } from "@/lib/prisma";

export type ResultadoTesteAsaas =
  | { ok: true; chargeId: string; invoiceUrl?: string; pixQrCode?: string; pixCopiaCola?: string }
  | { ok: false; erro: string };

export async function criarCobrancaTesteAsaasAction(): Promise<ResultadoTesteAsaas> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { ok: false, erro: "Apenas super admin." };

  const gateway = await getGateway();
  if (gateway.nome !== "ASAAS") return { ok: false, erro: "Gateway atual nao eh ASAAS." };

  const conta = usuario.conta;

  // Garante customer no Asaas (reutiliza gatewayCustomerId se existir)
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

  // Cria Cobranca no banco antes de chamar Asaas — assim o webhook que
  // chega depois consegue casar pelo externalReference.
  const cobranca = await prisma.cobranca.create({
    data: {
      contaId: conta.id,
      competencia,
      plano: conta.plano,
      forma: "PIX",
      valor: 10,
      status: "PENDENTE",
      vencimento,
      observacoes: "Teste de integracao Asaas (R$ 10)",
    },
  });

  try {
    const r = await gateway.criarCobranca({
      cobrancaIdInterno: cobranca.id,
      customerId,
      valor: 10,
      vencimento,
      descricao: "Teste de integracao Asaas (R$ 10)",
      forma: "PIX",
    });

    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        gatewayChargeId: r.chargeId,
        gatewayInvoiceUrl: r.invoiceUrl,
        pixQrCode: r.pixQrCode,
        pixCopiaCola: r.pixCopiaCola,
      },
    });

    return {
      ok: true,
      chargeId: r.chargeId,
      invoiceUrl: r.invoiceUrl,
      pixQrCode: r.pixQrCode,
      pixCopiaCola: r.pixCopiaCola,
    };
  } catch (e) {
    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: { status: "CANCELADA" },
    });
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
