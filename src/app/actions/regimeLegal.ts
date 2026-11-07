"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { lerBytesDoAnexo } from "@/lib/anexoBytes";
import { extrairRegimeDosAnexos } from "@/lib/extrairAta";
import { ehRegimeLegal, ROTULO_REGIME, sugerirRegimePorTexto } from "@/lib/regimeLegal";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";

type Result = { ok?: boolean; erro?: string; sugerido?: string | null; trecho?: string | null } | null;

/**
 * ESP-001, RN04 (Igor 07/11/2026): contrato cadastrado antes do campo
 * existir ganha um banner "Regime pendente" com sugestão da IA a partir dos
 * anexos já enviados (contrato + aditivos). A sugestão fica gravada em
 * `regimeSugerido` + trecho; `regimeLegal` só muda com a confirmação da
 * pessoa (`definirRegimeLegalAction`).
 */
export async function sugerirRegimeIaAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "").trim();
  if (!contratoId) return { erro: "Contrato não informado." };

  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true,
      objeto: true,
      anexos: {
        where: { categoria: { in: ["CONTRATUAL", "ADITIVO", "APOSTILAMENTO"] } },
        orderBy: { criadoEm: "asc" },
        select: { nome: true, url: true, mimeType: true },
      },
    },
  });
  if (!contrato) return { erro: "Contrato não encontrado." };

  // Só PDFs, até 20 MB somados (o mesmo teto da leitura conjunta do cadastro).
  const files: File[] = [];
  let total = 0;
  for (const a of contrato.anexos) {
    if (!/\.pdf$/i.test(a.nome) && a.mimeType !== "application/pdf") continue;
    const lido = await lerBytesDoAnexo(a.url, usuario.contaId, !!usuario.superAdmin);
    if (!lido) continue;
    if (total + lido.bytes.byteLength > 20 * 1024 * 1024) break;
    total += lido.bytes.byteLength;
    files.push(new File([lido.bytes as BlobPart], a.nome, { type: "application/pdf" }));
    if (files.length >= 6) break;
  }

  let regime: string | null = null;
  let trecho: string | null = null;
  if (files.length > 0) {
    try {
      const r = await extrairRegimeDosAnexos(files);
      regime = r.regimeLegal;
      trecho = r.trecho;
    } catch (e) {
      console.error("[sugerirRegimeIaAction] IA falhou:", e);
      return { erro: "A leitura dos anexos falhou agora. Tente de novo em instantes ou informe o regime manualmente." };
    }
  }
  // Sem PDF ou sem evidência no PDF: tenta o texto do objeto, que às vezes
  // cita a lei. Melhor do que nada; a pessoa confirma de qualquer jeito.
  if (!regime) {
    const h = sugerirRegimePorTexto(contrato.objeto);
    if (h) {
      regime = h.regime;
      trecho = h.trecho;
    }
  }

  await prisma.contrato.update({
    where: { id: contrato.id },
    data: { regimeSugerido: ehRegimeLegal(regime) ? regime : null, regimeSugeridoTrecho: trecho?.slice(0, 600) ?? null },
  });
  revalidatePath(`/contratos/${contrato.id}`);
  if (!regime) {
    return {
      ok: true,
      sugerido: null,
      trecho: null,
      erro: files.length === 0
        ? "Não há PDF do contrato ou de aditivo anexado para a IA ler. Informe o regime manualmente."
        : "A IA não encontrou citação da lei nos anexos. Informe o regime manualmente.",
    };
  }
  return { ok: true, sugerido: regime, trecho };
}

/** Confirma (ou define à mão) o regime legal de um contrato já cadastrado. */
export async function definirRegimeLegalAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "").trim();
  const regime = String(formData.get("regimeLegal") || "").trim();
  const outro = String(formData.get("regimeLegalOutro") || "").trim();
  if (!contratoId) return { erro: "Contrato não informado." };
  if (!ehRegimeLegal(regime)) return { erro: "Escolha o regime legal." };
  if (regime === "OUTRO" && !outro) return { erro: "Descreva qual é o regime." };

  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId: usuario.contaId } },
    select: { id: true, regimeLegal: true, regimeSugerido: true, responsavelId: true, criadoPorId: true },
  });
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };

  await prisma.contrato.update({
    where: { id: contrato.id },
    data: {
      regimeLegal: regime,
      regimeLegalOutro: regime === "OUTRO" ? outro : null,
      regimeConfirmadoEm: new Date(),
    },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Contrato",
    recursoId: contrato.id,
    resumo:
      `Regime legal definido: ${ROTULO_REGIME[regime]}${regime === "OUTRO" ? ` (${outro})` : ""}` +
      (contrato.regimeSugerido
        ? contrato.regimeSugerido === regime
          ? " — confirmando a sugestão da IA"
          : ` — diferente da sugestão da IA (${ROTULO_REGIME[contrato.regimeSugerido]})`
        : ""),
  }).catch(() => {});

  revalidatePath(`/contratos/${contrato.id}`);
  revalidatePath("/contratos");
  return { ok: true };
}
