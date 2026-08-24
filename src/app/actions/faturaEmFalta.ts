"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { getGateway } from "@/lib/gateway";
import { calcularValorMensal } from "@/lib/precos";
import { garantirCustomer } from "@/app/actions/assinatura";
import { traduzirErroGateway } from "@/lib/pagamentoAnalista";

/**
 * Gera a fatura do mês que ficou sem cobrança (Regina 24/08).
 *
 * Caso que motivou: o Léo venceu em 20/07 e pagou em 21/08. O sistema jogava o
 * próximo vencimento pra "hoje + 1 mês" — agosto nunca foi cobrado e ele
 * aparecia em dia. A regra do ciclo já foi corrigida, mas a competência que se
 * perdeu antes disso não volta sozinha: é isto aqui.
 *
 * A fatura nasce com 3 dias de prazo, não vencida, pra o cliente ter janela de
 * pagar antes de a trava por atraso entrar.
 */
export type ResultadoFatura = { ok?: true; mensagem?: string; erro?: string };

const DIAS_DE_PRAZO = 3;

export async function gerarFaturaEmFaltaAction(
  _prev: ResultadoFatura | null,
  formData: FormData,
): Promise<ResultadoFatura> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };

  const contaId = String(formData.get("contaId") || "").trim();
  const competencia = String(formData.get("competencia") || "").trim();
  if (!contaId || !/^\d{4}-\d{2}$/.test(competencia)) return { erro: "Dados incompletos." };

  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      id: true,
      plano: true,
      statusAssinatura: true,
      diaVencimento: true,
      proximoVencimento: true,
      empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1 },
      usuarios: { select: { superAdmin: true } },
    },
  });
  if (!conta) return { erro: "Conta não encontrada." };
  if (conta.usuarios.some((u) => u.superAdmin)) {
    return { erro: "Conta interna do CP System não é cobrada." };
  }

  const jaExiste = await prisma.cobranca.findFirst({
    where: {
      contaId,
      competencia,
      status: { in: ["PENDENTE", "PROCESSANDO", "ATRASADA", "PAGA"] },
    },
    select: { id: true },
  });
  if (jaExiste) return { erro: `Já existe cobrança para ${competencia}.` };

  const hoje = new Date();
  const vencimento = new Date(hoje.getTime() + DIAS_DE_PRAZO * 86400000);

  try {
    const breakdown = await calcularValorMensal(conta.id, conta.plano);
    const { customerId } = await garantirCustomer(conta.id);
    const gateway = await getGateway();

    const cobranca = await prisma.cobranca.create({
      data: {
        contaId: conta.id,
        competencia,
        plano: conta.plano,
        forma: "PIX",
        valor: breakdown.valorTotal,
        vencimento,
        status: "PENDENTE",
        observacoes: `Fatura de ${competencia} gerada manualmente — mês ficou sem cobrança`,
      },
    });

    const r = await gateway.criarCobranca({
      customerId,
      cobrancaIdInterno: cobranca.id,
      valor: breakdown.valorTotal,
      vencimento,
      forma: "PIX",
      descricao: `CP System — Plano ${conta.plano} (${competencia})`,
    });

    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        gatewayChargeId: r.chargeId,
        gatewayInvoiceUrl: r.invoiceUrl ?? null,
        pixQrCode: r.pixQrCode ?? null,
        pixCopiaCola: r.pixCopiaCola ?? null,
        status: r.status,
      },
    });

    // Realinha o ciclo: o próximo vencimento passa a ser o mês seguinte ao da
    // competência recuperada, no dia escolhido pelo cliente quando houver.
    const [ano, mes] = competencia.split("-").map(Number);
    const proximo = new Date(ano, mes, conta.diaVencimento ?? vencimento.getDate());
    await prisma.conta.update({
      where: { id: conta.id },
      data: { proximoVencimento: proximo },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Cobranca",
      recursoId: cobranca.id,
      resumo: `Gerou fatura de ${competencia} (R$ ${breakdown.valorTotal.toFixed(2)}) para ${conta.empresas[0]?.razaoSocial ?? conta.id} — mês estava sem cobrança`,
    });

    revalidatePath("/admin/gateway");
    revalidatePath("/conta/assinatura");
    return {
      ok: true,
      mensagem: `Fatura de ${competencia} gerada: R$ ${breakdown.valorTotal.toFixed(2)}, vence em ${vencimento.toLocaleDateString("pt-BR")}. O cliente já vê o PIX na tela de assinatura.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fatura-em-falta] falhou:", err);
    return { erro: traduzirErroGateway(msg) };
  }
}
