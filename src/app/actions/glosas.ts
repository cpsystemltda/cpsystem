"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { bloqueioModulo } from "@/lib/faixasTerceirizacaoServer";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarArquivo } from "@/lib/uploads";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { rotuloCompetencia } from "@/lib/competencias";
import { ROTULO_REGIME } from "@/lib/regimeLegal";
import {
  ROTULO_STATUS_GLOSA,
  ROTULO_TIPO_GLOSA,
  TIPOS_GLOSA,
  ajusteImr,
  faixasDe,
  somaGlosasAtivas,
  valorGlosaImr,
  type StatusGlosa,
  type TipoGlosa,
} from "@/lib/glosas";
import { gerarMinutaContestacao } from "@/lib/iaGlosa";

/**
 * Medição, glosas e IMR (ESP-005, Igor 07/11/2026). A glosa mora na
 * competência; `Competencia.valorGlosas` é a soma das ativas e entra no
 * faturado previsto. Depois da NF o faturado não muda: glosa revertida
 * vira competência complementar (RN02).
 */

type Result = { ok?: boolean; erro?: string; mensagem?: string; texto?: string } | null;

function parseDia(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function parseNum(s: FormDataEntryValue | null): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(/\s|R\$|%/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

async function carregarCompetencia(id: string, contaId: string) {
  return prisma.competencia.findFirst({
    where: { id, contrato: { empresa: { contaId } } },
    include: {
      glosas: true,
      contrato: {
        select: { id: true, numero: true, criadoPorId: true, orgaoNome: true, objeto: true, regimeLegal: true, regimeLegalOutro: true, empresa: { select: { razaoSocial: true, nomeFantasia: true } } },
      },
    },
  });
}

async function carregarGlosa(id: string, contaId: string) {
  return prisma.glosa.findFirst({
    where: { id, competencia: { contrato: { empresa: { contaId } } } },
    include: {
      contratoItem: { select: { descricao: true } },
      competencia: {
        include: {
          contrato: {
            select: { id: true, numero: true, criadoPorId: true, orgaoNome: true, objeto: true, regimeLegal: true, regimeLegalOutro: true, empresa: { select: { razaoSocial: true, nomeFantasia: true } } },
          },
        },
      },
    },
  });
}

/** Soma das glosas ativas → `valorGlosas` (o faturado fixado pela NF não muda). */
async function recalcularGlosas(competenciaId: string): Promise<number> {
  const glosas = await prisma.glosa.findMany({ where: { competenciaId }, select: { valor: true, status: true } });
  const total = somaGlosasAtivas(glosas);
  await prisma.competencia.update({ where: { id: competenciaId }, data: { valorGlosas: total } });
  return total;
}

function revalidar(competenciaId: string, contratoId: string) {
  revalidatePath(`/competencias/${competenciaId}`);
  revalidatePath(`/contratos/${contratoId}`);
}

// ─────────────────────────────────────────────
// Glosas (RN01, RN02)
// ─────────────────────────────────────────────

export async function criarGlosaAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const competenciaId = String(formData.get("competenciaId") || "");
  const c = await carregarCompetencia(competenciaId, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };

  const data = parseDia(String(formData.get("data") || ""));
  if (!data) return { erro: "Informe a data da glosa." };
  const tipo = String(formData.get("tipo") || "") as TipoGlosa;
  if (!TIPOS_GLOSA.includes(tipo)) return { erro: "Tipo de glosa inválido." };
  const valor = parseNum(formData.get("valor"));
  if (valor == null || valor <= 0) return { erro: "Informe o valor da glosa." };
  const motivo = String(formData.get("motivo") || "").trim();
  if (!motivo) return { erro: "Descreva o motivo da glosa." };
  const contratoItemId = String(formData.get("contratoItemId") || "").trim() || null;
  if (contratoItemId) {
    const item = await prisma.contratoItem.findFirst({ where: { id: contratoItemId, contratoId: c.contratoId }, select: { id: true } });
    if (!item) return { erro: "O posto escolhido não pertence a este contrato." };
  }
  const competenciaOrigemRef = String(formData.get("competenciaOrigemRef") || "").trim() || null;
  let arquivoUrl: string | null = null;
  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    try {
      arquivoUrl = (await salvarArquivo(arquivo)).url;
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Falha ao salvar o documento." };
    }
  }

  const g = await prisma.glosa.create({
    data: { competenciaId, contratoItemId, data, tipo, valor: r2(valor), motivo, arquivoUrl, competenciaOrigemRef, criadoPorId: usuario.id },
    select: { id: true },
  });
  const total = await recalcularGlosas(competenciaId);
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "Competencia",
    recursoId: competenciaId,
    resumo: `${rotuloCompetencia(c.competencia)}: glosa ${ROTULO_TIPO_GLOSA[tipo]} de R$ ${r2(valor).toFixed(2)} (${motivo.slice(0, 80)}) · total glosado R$ ${total.toFixed(2)}`,
  });
  revalidar(competenciaId, c.contratoId);
  return { ok: true, mensagem: c.valorFaturado != null ? "Glosa registrada. Como a NF já foi emitida, o faturado não muda; a glosa fica no registro para contestação e relatório." : "Glosa registrada.", texto: g.id };
}

const TRANSICOES: Record<StatusGlosa, StatusGlosa[]> = {
  APLICADA: ["CONTESTADA", "MANTIDA", "REVERTIDA"],
  CONTESTADA: ["MANTIDA", "REVERTIDA"],
  MANTIDA: ["CONTESTADA", "REVERTIDA"],
  REVERTIDA: [],
};

export async function mudarStatusGlosaAction(glosaId: string, novo: StatusGlosa): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const g = await carregarGlosa(glosaId, usuario.contaId);
  if (!g) return { erro: "Glosa não encontrada." };
  const contrato = g.competencia.contrato;
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  if (!TRANSICOES[g.status as StatusGlosa].includes(novo)) return { erro: `Glosa ${ROTULO_STATUS_GLOSA[g.status as StatusGlosa].toLowerCase()} não pode ir para ${ROTULO_STATUS_GLOSA[novo].toLowerCase()}.` };

  const agora = new Date();
  const update: Record<string, unknown> = { status: novo };
  if (novo === "CONTESTADA") update.contestadaEm = agora;
  if (novo === "MANTIDA" || novo === "REVERTIDA") update.decididaEm = agora;

  let complementarMsg = "";
  if (novo === "REVERTIDA" && g.competencia.valorFaturado != null) {
    // RN02: depois da NF o valor volta por competência complementar.
    const comp = await prisma.competencia.create({
      data: {
        contratoId: contrato.id,
        vigenciaId: g.competencia.vigenciaId,
        tipo: "COMPLEMENTAR",
        competencia: g.competencia.competencia,
        periodoInicio: g.competencia.periodoInicio,
        periodoFim: g.competencia.periodoFim,
        diasPeriodo: g.competencia.diasPeriodo,
        diasBase: g.competencia.diasBase,
        valorMensalBase: g.valor,
        valorPrevisto: g.valor,
        status: "EM_EXECUCAO",
        complementarRef: `Glosa revertida (${ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa]}) da competência ${rotuloCompetencia(g.competencia.competencia)}`,
        complementarDetalhe: [`${rotuloCompetencia(g.competencia.competencia)}: glosa de R$ ${g.valor.toFixed(2)} revertida — ${g.motivo}`],
        criadaAutomaticamente: true,
        criadoPorId: usuario.id,
      },
      select: { id: true },
    });
    update.complementarId = comp.id;
    complementarMsg = " A diferença virou uma competência complementar.";
  }
  await prisma.glosa.update({ where: { id: glosaId }, data: update });
  await recalcularGlosas(g.competenciaId);
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Competencia",
    recursoId: g.competenciaId,
    resumo: `${rotuloCompetencia(g.competencia.competencia)}: glosa de R$ ${g.valor.toFixed(2)} (${ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa]}) ${ROTULO_STATUS_GLOSA[g.status as StatusGlosa].toLowerCase()} → ${ROTULO_STATUS_GLOSA[novo].toLowerCase()}${complementarMsg}`,
  });
  revalidar(g.competenciaId, contrato.id);
  return { ok: true, mensagem: `Glosa marcada como ${ROTULO_STATUS_GLOSA[novo].toLowerCase()}.${complementarMsg}` };
}

export async function excluirGlosaAction(glosaId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const g = await carregarGlosa(glosaId, usuario.contaId);
  if (!g) return { erro: "Glosa não encontrada." };
  const contrato = g.competencia.contrato;
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  if (g.complementarId) return { erro: "Esta glosa já gerou competência complementar; exclua a complementar antes." };
  await prisma.glosa.delete({ where: { id: glosaId } });
  await recalcularGlosas(g.competenciaId);
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "EXCLUIR", recurso: "Competencia", recursoId: g.competenciaId, resumo: `${rotuloCompetencia(g.competencia.competencia)}: glosa de R$ ${g.valor.toFixed(2)} (${ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa]}) excluída` });
  revalidar(g.competenciaId, contrato.id);
  return { ok: true, mensagem: "Glosa excluída." };
}

// ─────────────────────────────────────────────
// Contestação (RN04)
// ─────────────────────────────────────────────

export async function salvarContestacaoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const glosaId = String(formData.get("glosaId") || "");
  const g = await carregarGlosa(glosaId, usuario.contaId);
  if (!g) return { erro: "Glosa não encontrada." };
  if (!podeEditarDocumento(usuario, g.competencia.contrato)) return { erro: mensagemSemPermissao(g.competencia.contrato) };
  const texto = String(formData.get("contestacao") || "").trim();
  const marcar = formData.get("marcarContestada") === "1";
  await prisma.glosa.update({
    where: { id: glosaId },
    data: { contestacao: texto || null, ...(marcar && g.status === "APLICADA" ? { status: "CONTESTADA", contestadaEm: new Date() } : {}) },
  });
  if (marcar && g.status === "APLICADA") {
    await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: g.competenciaId, resumo: `${rotuloCompetencia(g.competencia.competencia)}: glosa de R$ ${g.valor.toFixed(2)} contestada` });
  }
  revalidar(g.competenciaId, g.competencia.contrato.id);
  return { ok: true, mensagem: marcar ? "Contestação salva e glosa marcada como contestada." : "Texto da contestação salvo." };
}

export async function gerarMinutaContestacaoAction(glosaId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const g = await carregarGlosa(glosaId, usuario.contaId);
  if (!g) return { erro: "Glosa não encontrada." };
  const contrato = g.competencia.contrato;
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  try {
    const texto = await gerarMinutaContestacao({
      empresa: contrato.empresa.razaoSocial || contrato.empresa.nomeFantasia || "a contratada",
      contratoNumero: contrato.numero,
      orgao: contrato.orgaoNome,
      objeto: contrato.objeto,
      regimeLegal: contrato.regimeLegal === "OUTRO" ? contrato.regimeLegalOutro || "regime próprio" : contrato.regimeLegal ? ROTULO_REGIME[contrato.regimeLegal] : "não informado no cadastro",
      competencia: rotuloCompetencia(g.competencia.competencia),
      valorPrevisto: g.competencia.valorPrevisto,
      glosa: {
        data: g.data.toLocaleDateString("pt-BR", { timeZone: "UTC" }),
        tipo: ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa],
        valor: g.valor,
        motivo: g.motivo,
        item: g.contratoItem?.descricao ?? null,
        status: ROTULO_STATUS_GLOSA[g.status as StatusGlosa],
      },
      observacoes: g.competencia.observacoes,
    });
    await prisma.glosa.update({ where: { id: glosaId }, data: { contestacao: texto } });
    await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "CRIAR", recurso: "Competencia", recursoId: g.competenciaId, resumo: `${rotuloCompetencia(g.competencia.competencia)}: minuta de contestação gerada pela IA para a glosa de R$ ${g.valor.toFixed(2)}` });
    revalidar(g.competenciaId, contrato.id);
    return { ok: true, texto };
  } catch (err) {
    const { avisarFalhaDeIa, ehFalhaDeCredito, mensagemParaCliente } = await import("@/lib/falhaIa");
    await avisarFalhaDeIa("minuta de contestação de glosa", err);
    return { erro: ehFalhaDeCredito(err) ? mensagemParaCliente() : err instanceof Error ? err.message : "Falha ao gerar a minuta." };
  }
}

// ─────────────────────────────────────────────
// IMR (RN03)
// ─────────────────────────────────────────────

export async function registrarImrAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const competenciaId = String(formData.get("competenciaId") || "");
  const c = await carregarCompetencia(competenciaId, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  if (c.valorFaturado != null) return { erro: "A NF desta competência já foi emitida: registre a diferença do IMR como glosa na competência seguinte ou como complementar." };
  let pontuacoes: { indicadorId: string; pontuacao: number }[] = [];
  try {
    pontuacoes = JSON.parse(String(formData.get("pontuacoes") || "[]"));
  } catch {
    return { erro: "Pontuações em formato inválido." };
  }
  pontuacoes = pontuacoes.filter((p) => p && typeof p.indicadorId === "string" && Number.isFinite(p.pontuacao));
  const indicadores = (await prisma.indicadorImr.findMany({ where: { contratoId: c.contratoId, ativo: true }, orderBy: { ordem: "asc" } })).map((i) => ({ id: i.id, nome: i.nome, faixas: faixasDe(i.faixas) }));
  const r = ajusteImr(indicadores, pontuacoes);
  const data = parseDia(String(formData.get("data") || "")) ?? new Date();
  const valor = valorGlosaImr(c.valorPrevisto, r.descontoPct);

  const existente = c.glosas.find((g) => g.tipo === "IMR" && g.status !== "REVERTIDA");
  const motivo = r.detalhes.length
    ? `IMR: ${r.detalhes.map((d) => `${d.nome} ${d.pontuacao} pts → ${d.percentualPagamento ?? "sem faixa"}%`).join("; ")} · desconto ${r.descontoPct}%`
    : "IMR sem indicadores pontuados";
  if (valor > 0) {
    if (existente) await prisma.glosa.update({ where: { id: existente.id }, data: { valor, motivo, data } });
    else await prisma.glosa.create({ data: { competenciaId, tipo: "IMR", data, valor, motivo, criadoPorId: usuario.id } });
  } else if (existente && existente.status === "APLICADA") {
    await prisma.glosa.delete({ where: { id: existente.id } });
  }
  await prisma.competencia.update({
    where: { id: competenciaId },
    data: { imrPontuacoes: r.detalhes.map((d) => ({ indicadorId: d.indicadorId, pontuacao: d.pontuacao, percentualPagamento: d.percentualPagamento })) },
  });
  const total = await recalcularGlosas(competenciaId);
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: competenciaId, resumo: `${rotuloCompetencia(c.competencia)}: ${motivo} · glosa IMR R$ ${valor.toFixed(2)} · total glosado R$ ${total.toFixed(2)}` });
  revalidar(competenciaId, c.contratoId);
  const aviso = r.semFaixa.length ? ` Sem faixa para: ${r.semFaixa.join(", ")}.` : "";
  return { ok: true, mensagem: valor > 0 ? `IMR aplicado: desconto de ${r.descontoPct}% (R$ ${valor.toFixed(2)}).${aviso}` : `IMR registrado sem desconto.${aviso}` };
}

export async function salvarIndicadorImrAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } }, select: { id: true, criadoPorId: true } });
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const id = String(formData.get("id") || "").trim() || null;
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { erro: "Informe o nome do indicador." };
  const meta = String(formData.get("meta") || "").trim() || null;
  const descricao = String(formData.get("descricao") || "").trim() || null;
  let faixas: unknown;
  try {
    faixas = JSON.parse(String(formData.get("faixas") || "[]"));
  } catch {
    return { erro: "Faixas em formato inválido." };
  }
  const lista = faixasDe(faixas).map((f) => ({ de: Math.min(f.de, f.ate), ate: Math.max(f.de, f.ate), percentualPagamento: f.percentualPagamento }));
  if (lista.length === 0) return { erro: "Informe ao menos uma faixa (pontuação de/até → % do valor)." };
  if (lista.some((f) => f.percentualPagamento < 0 || f.percentualPagamento > 100)) return { erro: "O percentual do valor fica entre 0 e 100." };
  const ordem = Number(formData.get("ordem") || 0) || 0;
  const salvo = id
    ? await prisma.indicadorImr.update({ where: { id }, data: { nome, meta, descricao, faixas: lista, ordem } })
    : await prisma.indicadorImr.create({ data: { contratoId, nome, meta, descricao, faixas: lista, ordem } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: id ? "ATUALIZAR" : "CRIAR", recurso: "Contrato", recursoId: contratoId, resumo: `IMR: indicador "${nome}" ${id ? "atualizado" : "criado"} (${lista.length} faixa(s))` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: `Indicador "${salvo.nome}" salvo.` };
}

export async function excluirIndicadorImrAction(id: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const ind = await prisma.indicadorImr.findFirst({ where: { id, contrato: { empresa: { contaId: usuario.contaId } } }, select: { id: true, nome: true, contrato: { select: { id: true, criadoPorId: true } } } });
  if (!ind) return { erro: "Indicador não encontrado." };
  if (!podeEditarDocumento(usuario, ind.contrato)) return { erro: mensagemSemPermissao(ind.contrato) };
  await prisma.indicadorImr.delete({ where: { id } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "EXCLUIR", recurso: "Contrato", recursoId: ind.contrato.id, resumo: `IMR: indicador "${ind.nome}" excluído` });
  revalidatePath(`/contratos/${ind.contrato.id}`);
  return { ok: true, mensagem: "Indicador excluído." };
}
