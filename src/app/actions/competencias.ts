"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarArquivo } from "@/lib/uploads";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import {
  ETAPAS,
  ORDEM_STATUS,
  ROTULO_STATUS,
  aplicarRetencoes,
  calcularFaturado,
  diaUtc,
  indiceStatus,
  prazoDePagamento,
  rotuloCompetencia,
  type EtapaKey,
  type StatusCompetencia,
} from "@/lib/competencias";
import {
  carregarContextoCompetencias,
  gerarCompetencias,
  recalcularPrevistos,
} from "@/lib/competenciasServer";

/**
 * Competências mensais (ESP-004, Igor 07/11/2026). Toda ação confere a conta
 * pelo contrato e a permissão de edição do documento; edição manual fica no
 * histórico (RN12) e exclusão é só de ADMIN com justificativa.
 */

type Result = { ok?: boolean; erro?: string; mensagem?: string } | null;

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
      contrato: { select: { id: true, numero: true, criadoPorId: true, termoInicialPagamento: true, prazoPagamentoDias: true, retencoesPadrao: true } },
    },
  });
}

async function carregarContratoDaConta(contratoId: string, contaId: string) {
  return prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId } },
    select: { id: true, numero: true, criadoPorId: true },
  });
}

// ─────────────────────────────────────────────
// Geração (RN01, RN08)
// ─────────────────────────────────────────────

export async function decidirRetroativasAction(contratoId: string, gerar: boolean): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contrato = await carregarContratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const ctx = await carregarContextoCompetencias(contratoId);
  if (!ctx) return { erro: "Contrato não encontrado." };

  await prisma.contrato.update({
    where: { id: contratoId },
    data: { competenciasRetroativasEm: new Date(), competenciasRetroativasGerar: gerar },
  });
  let criadas: { competencia: string }[] = [];
  if (gerar) {
    criadas = await gerarCompetencias({ ...ctx, competenciasRetroativasEm: new Date() }, { hoje: new Date(), somenteCorrente: false, statusPassadas: "A_CONFIRMAR", criadoPorId: usuario.id });
  } else {
    // Sem retroativas: ainda assim a corrente nasce agora, se faltar.
    criadas = await gerarCompetencias({ ...ctx, competenciasRetroativasEm: new Date() }, { hoje: new Date(), somenteCorrente: true, criadoPorId: usuario.id });
  }
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Contrato",
    recursoId: contratoId,
    resumo: gerar
      ? `Competências retroativas geradas (${criadas.length}): ${criadas.map((c) => rotuloCompetencia(c.competencia)).join(", ") || "nenhuma faltava"}`
      : "Optou por não gerar as competências já transcorridas",
  });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: gerar ? `${criadas.length} competência(s) criada(s) para conferência.` : "Combinado: só as próximas competências serão criadas." };
}

export async function gerarPendentesAction(contratoId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contrato = await carregarContratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const ctx = await carregarContextoCompetencias(contratoId);
  if (!ctx) return { erro: "Contrato não encontrado." };
  const criadas = await gerarCompetencias(ctx, { hoje: new Date(), somenteCorrente: false, statusPassadas: "A_CONFIRMAR", criadoPorId: usuario.id });
  if (criadas.length) {
    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Contrato",
      recursoId: contratoId,
      resumo: `Competências geradas à mão: ${criadas.map((c) => rotuloCompetencia(c.competencia)).join(", ")}`,
    });
  }
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: criadas.length ? `${criadas.length} competência(s) criada(s).` : "Nenhuma competência faltando até hoje." };
}

export async function confirmarCompetenciaAction(id: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const c = await carregarCompetencia(id, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  if (c.status !== "A_CONFIRMAR") return { ok: true };
  await prisma.competencia.update({ where: { id }, data: { status: "EM_EXECUCAO" } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: id, resumo: `Competência ${rotuloCompetencia(c.competencia)} confirmada` });
  revalidatePath(`/competencias/${id}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Etapas (RN04, RN05, RN07)
// ─────────────────────────────────────────────

export async function registrarEtapaAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("competenciaId") || "");
  const etapa = String(formData.get("etapa") || "") as EtapaKey;
  const def = ETAPAS.find((e) => e.key === etapa);
  if (!def) return { erro: "Etapa inválida." };
  const c = await carregarCompetencia(id, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };

  const data = parseDia(String(formData.get("data") || ""));
  if (!data) return { erro: "Informe a data da etapa." };
  const responsavel = String(formData.get("responsavel") || "").trim() || usuario.nome || null;

  let arquivoUrl: string | null = null;
  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    try {
      arquivoUrl = (await salvarArquivo(arquivo)).url;
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Falha ao salvar o anexo." };
    }
  }

  const update: Record<string, unknown> = {
    [def.campoData]: data,
    [def.campoResp]: responsavel,
  };
  if (arquivoUrl) update[def.campoArquivo] = arquivoUrl;
  const resumoExtras: string[] = [];

  if (etapa === "NF_EMITIDA") {
    const numeroNf = String(formData.get("numeroNf") || "").trim();
    const ajustes = parseNum(formData.get("ajustes")) ?? c.ajustes ?? 0;
    const just = String(formData.get("ajustesJustificativa") || "").trim();
    if (ajustes !== 0 && !just && !c.ajustesJustificativa) return { erro: "Ajuste no valor exige justificativa." };
    let retencoesEntrada: { codigo: string; rotulo: string; pct: number | null; valor?: number | null }[] = [];
    try {
      const bruto = String(formData.get("retencoes") || "[]");
      retencoesEntrada = JSON.parse(bruto);
      if (!Array.isArray(retencoesEntrada)) retencoesEntrada = [];
    } catch {
      return { erro: "Retenções em formato inválido." };
    }
    const faturado = calcularFaturado(c.valorPrevisto, c.valorGlosas, ajustes);
    const { retencoes, total, liquido } = aplicarRetencoes(faturado, retencoesEntrada);
    Object.assign(update, {
      numeroNf: numeroNf || null,
      ajustes,
      ajustesJustificativa: just || c.ajustesJustificativa,
      valorFaturado: faturado,
      retencoes,
      valorRetencoes: total,
      valorLiquidoEsperado: liquido,
    });
    // Sugestão para o próximo mês (RN05): os percentuais ficam no contrato.
    await prisma.contrato.update({
      where: { id: c.contratoId },
      data: { retencoesPadrao: retencoes.map((r) => ({ codigo: r.codigo, rotulo: r.rotulo, pct: r.pct })) },
    });
    resumoExtras.push(`NF ${numeroNf || "s/n"} · faturado R$ ${faturado.toFixed(2)} · líquido R$ ${liquido.toFixed(2)}`);
  }
  if (etapa === "PAGA") {
    const recebido = parseNum(formData.get("valorRecebido"));
    update.valorRecebido = recebido ?? c.valorLiquidoEsperado ?? c.valorFaturado ?? c.valorPrevisto;
    resumoExtras.push(`recebido R$ ${Number(update.valorRecebido).toFixed(2)}`);
  }

  // Status: avança até a etapa marcada (nunca volta por aqui).
  const novoStatus: StatusCompetencia = indiceStatus(etapa) > indiceStatus(c.status) ? etapa : c.status;
  update.status = novoStatus;

  // RN07: prazo de pagamento a partir do termo inicial do contrato.
  const prazo = prazoDePagamento({
    termoInicial: c.contrato.termoInicialPagamento,
    prazoDias: c.contrato.prazoPagamentoDias,
    dataAteste: etapa === "ATESTADA" ? data : c.dataAteste,
    dataNfEncaminhada: etapa === "NF_ENCAMINHADA" ? data : c.dataNfEncaminhada,
    dataNfEmitida: etapa === "NF_EMITIDA" ? data : c.dataNfEmitida,
  });
  if (prazo) update.prazoPagamento = prazo;

  await prisma.competencia.update({ where: { id }, data: update });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Competencia",
    recursoId: id,
    resumo: `${rotuloCompetencia(c.competencia)}: ${def.rotulo} em ${data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}${responsavel ? ` (${responsavel})` : ""}${resumoExtras.length ? " · " + resumoExtras.join(" · ") : ""}`,
  });
  revalidatePath(`/competencias/${id}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true, mensagem: `${def.rotulo}: registrada.` };
}

export async function desfazerEtapaAction(id: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const c = await carregarCompetencia(id, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  const atual = ETAPAS.find((e) => e.key === c.status);
  if (!atual) return { erro: "Não há etapa para desfazer." };
  const update: Record<string, unknown> = { [atual.campoData]: null, [atual.campoResp]: null, [atual.campoArquivo]: null };
  if (atual.key === "NF_EMITIDA") Object.assign(update, { valorFaturado: null, retencoes: null, valorRetencoes: 0, valorLiquidoEsperado: null, numeroNf: null });
  if (atual.key === "PAGA") update.valorRecebido = null;
  // Volta para a última etapa anterior que tenha data.
  let novo: StatusCompetencia = "EM_EXECUCAO";
  for (let i = indiceStatus(atual.key) - 1; i >= indiceStatus("MEDICAO"); i--) {
    const e = ETAPAS.find((x) => x.key === ORDEM_STATUS[i]);
    if (e && (c as unknown as Record<string, unknown>)[e.campoData]) {
      novo = e.key;
      break;
    }
  }
  update.status = novo;
  await prisma.competencia.update({ where: { id }, data: update });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: id, resumo: `${rotuloCompetencia(c.competencia)}: etapa "${atual.rotulo}" desfeita (volta a ${ROTULO_STATUS[novo]})` });
  revalidatePath(`/competencias/${id}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Edição manual (RN12), empenhos (RN06), complementar (RN09), suspensão (RN10)
// ─────────────────────────────────────────────

export async function atualizarCompetenciaAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("competenciaId") || "");
  const c = await carregarCompetencia(id, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };

  const valorPrevisto = parseNum(formData.get("valorPrevisto"));
  const ajustes = parseNum(formData.get("ajustes"));
  const just = String(formData.get("ajustesJustificativa") || "").trim();
  const observacoes = String(formData.get("observacoes") || "").trim();
  const mudancas: { campo: string; rotulo: string; antes: string; depois: string }[] = [];
  const update: Record<string, unknown> = {};
  if (valorPrevisto != null && r2(valorPrevisto) !== c.valorPrevisto) {
    if (c.valorFaturado != null) return { erro: "A NF já foi emitida: o valor previsto não muda mais. Use uma competência complementar." };
    update.valorPrevisto = r2(valorPrevisto);
    mudancas.push({ campo: "valorPrevisto", rotulo: "Valor previsto", antes: c.valorPrevisto.toFixed(2), depois: r2(valorPrevisto).toFixed(2) });
  }
  if (ajustes != null && r2(ajustes) !== c.ajustes) {
    if (r2(ajustes) !== 0 && !just && !c.ajustesJustificativa) return { erro: "Ajuste no valor exige justificativa." };
    update.ajustes = r2(ajustes);
    mudancas.push({ campo: "ajustes", rotulo: "Ajustes", antes: c.ajustes.toFixed(2), depois: r2(ajustes).toFixed(2) });
  }
  if (just && just !== (c.ajustesJustificativa ?? "")) {
    update.ajustesJustificativa = just;
    mudancas.push({ campo: "ajustesJustificativa", rotulo: "Justificativa do ajuste", antes: c.ajustesJustificativa ?? "", depois: just });
  }
  if (observacoes !== (c.observacoes ?? "")) {
    update.observacoes = observacoes || null;
    mudancas.push({ campo: "observacoes", rotulo: "Observações", antes: c.observacoes ?? "", depois: observacoes });
  }
  if (mudancas.length === 0) return { ok: true, mensagem: "Nada mudou." };
  await prisma.competencia.update({ where: { id }, data: update });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Competencia",
    recursoId: id,
    titulo: `Competência ${rotuloCompetencia(c.competencia)} editada à mão`,
    mudancas,
  });
  revalidatePath(`/competencias/${id}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true, mensagem: "Competência atualizada." };
}

export async function vincularEmpenhoAction(competenciaId: string, empenhoId: string, valor: number | null): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const c = await carregarCompetencia(competenciaId, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  const empenho = await prisma.empenho.findFirst({ where: { id: empenhoId, contratoId: c.contratoId }, select: { id: true, numero: true } });
  if (!empenho) return { erro: "Este empenho não pertence ao contrato." };
  await prisma.competenciaEmpenho.upsert({
    where: { competenciaId_empenhoId: { competenciaId, empenhoId } },
    create: { competenciaId, empenhoId, valor: valor != null ? r2(valor) : null },
    update: { valor: valor != null ? r2(valor) : null },
  });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: competenciaId, resumo: `${rotuloCompetencia(c.competencia)}: vinculada ao empenho ${empenho.numero}${valor != null ? ` (R$ ${r2(valor).toFixed(2)})` : ""}` });
  revalidatePath(`/competencias/${competenciaId}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true };
}

export async function desvincularEmpenhoAction(competenciaId: string, empenhoId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const c = await carregarCompetencia(competenciaId, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  await prisma.competenciaEmpenho.deleteMany({ where: { competenciaId, empenhoId } });
  revalidatePath(`/competencias/${competenciaId}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true };
}

export async function excluirCompetenciaAction(id: string, justificativa: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!(usuario.superAdmin || usuario.perfil === "ADMIN")) return { erro: "Só um ADMIN da empresa pode excluir competência." };
  if (!justificativa.trim()) return { erro: "Informe a justificativa da exclusão." };
  const c = await carregarCompetencia(id, usuario.contaId);
  if (!c) return { erro: "Competência não encontrada." };
  await prisma.competencia.delete({ where: { id } });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "Contrato",
    recursoId: c.contratoId,
    resumo: `Competência ${rotuloCompetencia(c.competencia)}${c.tipo === "COMPLEMENTAR" ? " (complementar)" : ""} excluída · R$ ${c.valorPrevisto.toFixed(2)} · motivo: ${justificativa.trim()}`,
  });
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true };
}

export async function criarCompetenciaComplementarAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await carregarContratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const competencia = String(formData.get("competencia") || "").trim();
  if (!/^\d{4}-\d{2}$/.test(competencia)) return { erro: "Informe a competência de referência (mês/ano)." };
  const valor = parseNum(formData.get("valor"));
  if (valor == null || valor === 0) return { erro: "Informe o valor da competência complementar." };
  const ref = String(formData.get("complementarRef") || "").trim();
  if (!ref) return { erro: "Informe a apostila ou o aditivo que originou a diferença." };
  const detalheTexto = String(formData.get("detalhe") || "").trim();
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1, 1));
  const fim = new Date(Date.UTC(ano, mes, 0));
  const vig = await prisma.vigencia.findFirst({
    where: { contratoId, dataInicio: { lte: fim }, dataFim: { gte: inicio } },
    orderBy: { ordem: "desc" },
    select: { id: true },
  });
  const criada = await prisma.competencia.create({
    data: {
      contratoId,
      vigenciaId: vig?.id ?? null,
      tipo: "COMPLEMENTAR",
      competencia,
      periodoInicio: inicio,
      periodoFim: fim,
      diasPeriodo: fim.getUTCDate(),
      diasBase: fim.getUTCDate(),
      valorMensalBase: r2(valor),
      valorPrevisto: r2(valor),
      status: "EM_EXECUCAO",
      complementarRef: ref,
      complementarDetalhe: detalheTexto ? detalheTexto.split("\n").map((l) => l.trim()).filter(Boolean) : undefined,
      criadaAutomaticamente: false,
      criadoPorId: usuario.id,
    },
    select: { id: true },
  });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "CRIAR", recurso: "Competencia", recursoId: criada.id, resumo: `Competência complementar ${rotuloCompetencia(competencia)} · R$ ${r2(valor).toFixed(2)} · ${ref}` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: "Competência complementar criada." };
}

export async function registrarSuspensaoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await carregarContratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const limpar = formData.get("limpar") === "1";
  const inicio = parseDia(String(formData.get("inicio") || ""));
  const fim = parseDia(String(formData.get("fim") || ""));
  if (!limpar && !inicio) return { erro: "Informe o início da suspensão." };
  if (inicio && fim && fim < inicio) return { erro: "O fim da suspensão é anterior ao início." };
  await prisma.contrato.update({ where: { id: contratoId }, data: { suspensaoInicio: limpar ? null : inicio, suspensaoFim: limpar ? null : fim } });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Contrato",
    recursoId: contratoId,
    resumo: limpar ? "Suspensão removida: competências voltam a ser geradas" : `Suspensão registrada de ${inicio!.toLocaleDateString("pt-BR", { timeZone: "UTC" })}${fim ? ` a ${fim.toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : " (sem fim definido)"}: nenhuma competência nasce no período`,
  });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: limpar ? "Suspensão removida." : "Suspensão registrada." };
}

// ─────────────────────────────────────────────
// ESP-002 RN07: acréscimo/supressão de postos por aditivo
// ─────────────────────────────────────────────

type AlteracaoPosto = {
  itemId?: string | null;
  descricao: string;
  unidade?: string | null;
  quantidade: number;
  valorUnitario: number;
  remover?: boolean;
  cbo?: string | null;
  jornada?: string | null;
  localPrestacao?: string | null;
  colaboradoresPorPosto?: number | null;
};

export async function alterarPostosAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "");
  const vigenciaId = String(formData.get("vigenciaId") || "");
  const contrato = await carregarContratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const dataEfeito = parseDia(String(formData.get("dataEfeito") || ""));
  if (!dataEfeito) return { erro: "Informe a data de efeito da alteração." };
  const termoAditivoId = String(formData.get("termoAditivoId") || "").trim() || null;
  if (termoAditivoId) {
    const ta = await prisma.termoAditivo.findFirst({ where: { id: termoAditivoId, contratoId }, select: { id: true } });
    if (!ta) return { erro: "Aditivo não pertence a este contrato." };
  }
  const vig = await prisma.vigencia.findFirst({ where: { id: vigenciaId, contratoId }, select: { id: true, dataInicio: true, dataFim: true } });
  if (!vig) return { erro: "Vigência não encontrada." };
  if (diaUtc(dataEfeito) < diaUtc(vig.dataInicio) || diaUtc(dataEfeito) > diaUtc(vig.dataFim)) return { erro: "A data de efeito precisa estar dentro da vigência." };

  let alteracoes: AlteracaoPosto[] = [];
  try {
    alteracoes = JSON.parse(String(formData.get("alteracoes") || "[]"));
  } catch {
    return { erro: "Alterações em formato inválido." };
  }
  alteracoes = alteracoes.filter((a) => a && (a.itemId || a.descricao?.trim()));
  if (alteracoes.length === 0) return { erro: "Nenhuma alteração informada." };

  const itensAtuais = await prisma.contratoItem.findMany({ where: { contratoId, vigenciaId }, select: { id: true, descricao: true, unidade: true, quantidade: true, valorUnitario: true, cbo: true, jornada: true, localPrestacao: true, colaboradoresPorPosto: true, unidadeMaoDeObra: true, lote: true, numero: true, ataItemId: true, vigenteAte: true } });
  const porId = new Map(itensAtuais.map((i) => [i.id, i]));
  const diaAnterior = new Date(diaUtc(dataEfeito).getTime() - 86_400_000 + 12 * 3_600_000);
  const efeito = new Date(diaUtc(dataEfeito).getTime() + 12 * 3_600_000);
  const resumo: string[] = [];

  await prisma.$transaction(async (tx) => {
    for (const a of alteracoes) {
      const antigo = a.itemId ? porId.get(a.itemId) : null;
      if (a.itemId && !antigo) throw new Error("Item não pertence a esta vigência.");
      if (antigo) {
        const mudou = a.remover || r2(a.quantidade) !== antigo.quantidade || r2(a.valorUnitario) !== antigo.valorUnitario;
        if (!mudou) continue;
        await tx.contratoItem.update({ where: { id: antigo.id }, data: { vigenteAte: diaAnterior } });
        if (a.remover) {
          resumo.push(`${antigo.descricao}: suprimido`);
          continue;
        }
        await tx.contratoItem.create({
          data: {
            contratoId,
            vigenciaId,
            descricao: antigo.descricao,
            unidade: antigo.unidade,
            quantidade: r2(a.quantidade),
            valorUnitario: r2(a.valorUnitario),
            valorTotal: r2(a.quantidade * a.valorUnitario),
            cbo: antigo.cbo,
            jornada: antigo.jornada,
            localPrestacao: antigo.localPrestacao,
            colaboradoresPorPosto: antigo.colaboradoresPorPosto,
            unidadeMaoDeObra: antigo.unidadeMaoDeObra,
            lote: antigo.lote,
            numero: antigo.numero,
            ataItemId: antigo.ataItemId,
            vigenteDe: efeito,
            substituiItemId: antigo.id,
            alteradoPorAditivoId: termoAditivoId,
          },
        });
        resumo.push(`${antigo.descricao}: ${antigo.quantidade} × R$ ${antigo.valorUnitario.toFixed(2)} → ${r2(a.quantidade)} × R$ ${r2(a.valorUnitario).toFixed(2)}`);
      } else {
        if (!(a.quantidade > 0) || !(a.valorUnitario >= 0)) throw new Error(`Quantidade/valor inválidos em "${a.descricao}".`);
        await tx.contratoItem.create({
          data: {
            contratoId,
            vigenciaId,
            descricao: a.descricao.trim(),
            unidade: a.unidade?.trim() || "POSTO",
            quantidade: r2(a.quantidade),
            valorUnitario: r2(a.valorUnitario),
            valorTotal: r2(a.quantidade * a.valorUnitario),
            cbo: a.cbo?.trim() || null,
            jornada: a.jornada?.trim() || null,
            localPrestacao: a.localPrestacao?.trim() || null,
            colaboradoresPorPosto: a.colaboradoresPorPosto ?? 1,
            unidadeMaoDeObra: "POSTO",
            vigenteDe: efeito,
            alteradoPorAditivoId: termoAditivoId,
          },
        });
        resumo.push(`${a.descricao.trim()}: novo posto, ${r2(a.quantidade)} × R$ ${r2(a.valorUnitario).toFixed(2)}`);
      }
    }
  });
  if (resumo.length === 0) return { ok: true, mensagem: "Nada mudou nos postos." };

  const recalculadas = await recalcularPrevistos(contratoId, dataEfeito);
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Contrato",
    recursoId: contratoId,
    resumo: `Postos alterados com efeito em ${dataEfeito.toLocaleDateString("pt-BR", { timeZone: "UTC" })}${termoAditivoId ? " (aditivo)" : ""}: ${resumo.join("; ")}${recalculadas ? ` · ${recalculadas} competência(s) recalculada(s)` : ""}`,
  });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: `Postos atualizados. ${recalculadas ? `${recalculadas} competência(s) tiveram o previsto recalculado.` : ""}` };
}
