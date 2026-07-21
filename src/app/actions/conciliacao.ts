"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import { contaTemAcessoConciliacao } from "@/lib/conciliacao/planoGuard";
import { processarExtrato } from "@/lib/conciliacao/processar";

type Result = { ok?: true; erro?: string; extratoId?: string; jaProcessado?: boolean };

// Upload de extrato PDF (fluxo web).
export async function uploadExtratoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  if (!contaTemAcessoConciliacao(usuario.conta.plano)) {
    return { erro: "Conciliação bancária disponível apenas nos planos INTERMEDIARIO e PREMIUM." };
  }

  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { erro: "Envie um PDF do extrato bancário." };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { erro: "Só aceita arquivos PDF." };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { erro: "PDF deve ter no máximo 20 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await processarExtrato({
    contaId: usuario.contaId,
    fonte: "WEB_UPLOAD",
    nomeArquivo: file.name,
    pdfBuffer: buffer,
  });

  if (!result.ok) {
    return { erro: result.erro };
  }

  revalidatePath("/conciliacao");
  return { ok: true, extratoId: result.extratoId, jaProcessado: result.jaProcessado };
}

// Cliente aceita uma sugestao de match (score medio 50-85).
export async function confirmarConciliacaoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const conciliacaoId = String(formData.get("conciliacaoId") || "");
  if (!conciliacaoId) return { erro: "conciliacaoId ausente" };

  const c = await prisma.conciliacao.findUnique({
    where: { id: conciliacaoId },
    select: { transacao: { select: { extrato: { select: { contaId: true } } } }, empenhoId: true },
  });
  if (!c) return { erro: "Conciliação não encontrada" };
  if (c.transacao.extrato.contaId !== usuario.contaId) return { erro: "Sem permissão" };

  await prisma.$transaction([
    prisma.conciliacao.update({
      where: { id: conciliacaoId },
      data: { status: "CONFIRMADA", confirmadaEm: new Date(), confirmadaPorId: usuario.id },
    }),
    prisma.empenho.update({
      where: { id: c.empenhoId },
      data: { status: "PAGO" },
    }),
  ]);

  revalidatePath("/conciliacao");
  return { ok: true };
}

export async function rejeitarConciliacaoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const conciliacaoId = String(formData.get("conciliacaoId") || "");
  if (!conciliacaoId) return { erro: "conciliacaoId ausente" };
  const c = await prisma.conciliacao.findUnique({
    where: { id: conciliacaoId },
    select: { transacao: { select: { extrato: { select: { contaId: true } } } } },
  });
  if (!c) return { erro: "Conciliação não encontrada" };
  if (c.transacao.extrato.contaId !== usuario.contaId) return { erro: "Sem permissão" };
  await prisma.conciliacao.update({
    where: { id: conciliacaoId },
    data: { status: "REJEITADA" },
  });
  revalidatePath("/conciliacao");
  return { ok: true };
}

// Cliente configura ou desliga a janela de conciliacao.
export async function configurarJanelaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!contaTemAcessoConciliacao(usuario.conta.plano)) {
    return { erro: "Recurso disponível a partir do plano INTERMEDIARIO." };
  }
  const diaMesRaw = formData.get("diaMes");
  const optInRaw = formData.get("optIn");

  const diaMes = diaMesRaw ? Number(diaMesRaw) : null;
  if (diaMes !== null && (isNaN(diaMes) || diaMes < 1 || diaMes > 31)) {
    return { erro: "Dia do mês deve ser entre 1 e 31." };
  }
  const optIn = optInRaw === "on" || optInRaw === "true" || optInRaw === "1";

  await prisma.conta.update({
    where: { id: usuario.contaId },
    data: { conciliacaoDiaMes: diaMes, conciliacaoOptIn: optIn },
  });
  revalidatePath("/conciliacao");
  revalidatePath("/conta");
  return { ok: true };
}
