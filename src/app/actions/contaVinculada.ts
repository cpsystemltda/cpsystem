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
  CHAVE_PARAMETRO_PERCENTUAIS,
  FATOS_GERADORES,
  GARANTIAS_VERBAS,
  ROTULO_FATO_GERADOR,
  ROTULO_GARANTIA_VERBAS,
  ROTULO_STATUS_PEDIDO,
  STATUS_PEDIDO,
  percentuaisDe,
  type FatoGerador,
  type GarantiaVerbas,
  type StatusPedido,
} from "@/lib/contaVinculada";
import { estimarRetencaoDaCompetencia, percentuaisPadrao, recalcularRetencoesDoContrato, resumoContaVinculada, temGarantiaVerbas } from "@/lib/contaVinculadaServer";
import { gerarMinutaLiberacao } from "@/lib/iaContaVinculada";

/**
 * Conta vinculada e pagamento pelo fato gerador (ESP-006, Igor 07/11/2026).
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

async function contratoDaConta(contratoId: string, contaId: string) {
  return prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId } },
    select: { id: true, numero: true, criadoPorId: true, orgaoNome: true, objeto: true, regimeLegal: true, regimeLegalOutro: true, garantiaVerbas: true, empresa: { select: { razaoSocial: true, nomeFantasia: true } } },
  });
}

// ─────────────────────────────────────────────
// Admin: tabela-padrão de percentuais (RN02)
// ─────────────────────────────────────────────

export async function salvarPercentuaisPadraoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Só o gestor da plataforma altera a tabela-padrão." };
  const p = percentuaisDe({
    decimoTerceiro: parseNum(formData.get("decimoTerceiro")),
    feriasTerco: parseNum(formData.get("feriasTerco")),
    multaFgts: parseNum(formData.get("multaFgts")),
    incidencia22: { "1": parseNum(formData.get("incidencia1")), "2": parseNum(formData.get("incidencia2")), "3": parseNum(formData.get("incidencia3")) },
  });
  await prisma.parametroPlataforma.upsert({
    where: { chave: CHAVE_PARAMETRO_PERCENTUAIS },
    create: { chave: CHAVE_PARAMETRO_PERCENTUAIS, valor: p, atualizadoPorId: usuario.id },
    update: { valor: p, atualizadoPorId: usuario.id },
  });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "ParametroPlataforma", recursoId: CHAVE_PARAMETRO_PERCENTUAIS, resumo: `Tabela-padrão da conta vinculada: 13º ${p.decimoTerceiro}% · férias ${p.feriasTerco}% · multa FGTS ${p.multaFgts}% · incidência 2.2 ${p.incidencia22["1"]}/${p.incidencia22["2"]}/${p.incidencia22["3"]}%` });
  revalidatePath("/admin-plataforma/conta-vinculada");
  return { ok: true, mensagem: "Tabela-padrão salva. Contratos sem percentuais próprios passam a usar estes valores." };
}

// ─────────────────────────────────────────────
// Contrato: garantia, RAT, percentuais próprios (RN01, RN02)
// ─────────────────────────────────────────────

export async function definirGarantiaVerbasAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await contratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const garantia = String(formData.get("garantiaVerbas") || "") as GarantiaVerbas;
  if (!GARANTIAS_VERBAS.includes(garantia)) return { erro: "Escolha a garantia de verbas trabalhistas." };
  const outra = String(formData.get("garantiaVerbasOutra") || "").trim();
  if (garantia === "OUTRA" && !outra) return { erro: "Descreva qual é a garantia." };
  const rat = Number(formData.get("ratPct") || 0);
  const prazo = parseNum(formData.get("prazoAlertaLiberacaoDias"));
  await prisma.contrato.update({
    where: { id: contratoId },
    data: { garantiaVerbas: garantia, garantiaVerbasOutra: garantia === "OUTRA" ? outra : null, ratPct: [1, 2, 3].includes(rat) ? rat : null, prazoAlertaLiberacaoDias: prazo != null && prazo > 0 ? Math.round(prazo) : null },
  });
  const n = temGarantiaVerbas(garantia) ? await recalcularRetencoesDoContrato(contratoId) : 0;
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Contrato", recursoId: contratoId, resumo: `Garantia de verbas trabalhistas: ${ROTULO_GARANTIA_VERBAS[garantia]}${garantia === "OUTRA" ? ` (${outra})` : ""}${rat ? ` · RAT ${rat}%` : ""}${n ? ` · ${n} competência(s) com retenção estimada` : ""}` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: "Garantia registrada." };
}

export async function salvarPercentuaisContratoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await contratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const voltarPadrao = formData.get("voltarPadrao") === "1";
  if (voltarPadrao) {
    await prisma.contrato.update({ where: { id: contratoId }, data: { percentuaisContaVinculada: undefined as never } }).catch(() => null);
    await prisma.$executeRaw`UPDATE "Contrato" SET "percentuaisContaVinculada" = NULL WHERE id = ${contratoId}`;
  } else {
    const padrao = await percentuaisPadrao();
    const p = percentuaisDe(
      {
        decimoTerceiro: parseNum(formData.get("decimoTerceiro")),
        feriasTerco: parseNum(formData.get("feriasTerco")),
        multaFgts: parseNum(formData.get("multaFgts")),
        incidencia22: { "1": parseNum(formData.get("incidencia1")), "2": parseNum(formData.get("incidencia2")), "3": parseNum(formData.get("incidencia3")) },
      },
      padrao,
    );
    await prisma.contrato.update({ where: { id: contratoId }, data: { percentuaisContaVinculada: p } });
  }
  const n = await recalcularRetencoesDoContrato(contratoId);
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Contrato", recursoId: contratoId, resumo: voltarPadrao ? `Conta vinculada: percentuais voltaram à tabela-padrão · ${n} competência(s) recalculada(s)` : `Conta vinculada: percentuais próprios do contrato salvos · ${n} competência(s) recalculada(s)` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: voltarPadrao ? "Percentuais da tabela-padrão restaurados." : "Percentuais do contrato salvos." };
}

export async function recalcularRetencoesAction(contratoId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contrato = await contratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const n = await recalcularRetencoesDoContrato(contratoId);
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: `${n} competência(s) com a retenção estimada atualizada.` };
}

// ─────────────────────────────────────────────
// Competência: valor efetivamente retido (RN03)
// ─────────────────────────────────────────────

export async function informarRetencaoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const competenciaId = String(formData.get("competenciaId") || "");
  const c = await prisma.competencia.findFirst({
    where: { id: competenciaId, contrato: { empresa: { contaId: usuario.contaId } } },
    select: { id: true, competencia: true, contratoId: true, retencaoCvEstimada: true, contrato: { select: { criadoPorId: true } } },
  });
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  const limpar = formData.get("limpar") === "1";
  const valor = parseNum(formData.get("valor"));
  if (!limpar && (valor == null || valor < 0)) return { erro: "Informe o valor retido pelo órgão." };
  if (!limpar && c.retencaoCvEstimada == null) await estimarRetencaoDaCompetencia(c.id);
  await prisma.competencia.update({ where: { id: c.id }, data: { retencaoCvInformada: limpar ? null : r2(valor as number) } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: c.id, resumo: limpar ? `${rotuloCompetencia(c.competencia)}: retenção informada removida (volta a valer a estimativa)` : `${rotuloCompetencia(c.competencia)}: retenção para conta vinculada informada R$ ${r2(valor as number).toFixed(2)} (estimada R$ ${(c.retencaoCvEstimada ?? 0).toFixed(2)})` });
  revalidatePath(`/competencias/${c.id}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true, mensagem: limpar ? "Valor informado removido." : "Valor retido registrado." };
}

// ─────────────────────────────────────────────
// Pedidos de liberação (RN05) e minuta (RN09)
// ─────────────────────────────────────────────

export async function salvarPedidoLiberacaoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await contratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const id = String(formData.get("id") || "").trim() || null;
  const fatoGerador = String(formData.get("fatoGerador") || "") as FatoGerador;
  if (!FATOS_GERADORES.includes(fatoGerador)) return { erro: "Escolha o fato gerador." };
  const fatoGeradorOutro = String(formData.get("fatoGeradorOutro") || "").trim() || null;
  if (fatoGerador === "OUTRO" && !fatoGeradorOutro) return { erro: "Descreva o fato gerador." };
  const valor = parseNum(formData.get("valorSolicitado"));
  if (valor == null || valor <= 0) return { erro: "Informe o valor solicitado." };
  const dataPedido = parseDia(String(formData.get("dataPedido") || "")) ?? new Date();
  const competenciaRef = String(formData.get("competenciaRef") || "").trim() || null;
  if (competenciaRef && !/^\d{4}-\d{2}$/.test(competenciaRef)) return { erro: "Competência de referência inválida." };
  const colaboradores = String(formData.get("colaboradores") || "").trim() || null;
  const protocolo = String(formData.get("protocolo") || "").trim() || null;
  const observacoes = String(formData.get("observacoes") || "").trim() || null;
  const statusForm = String(formData.get("status") || "RASCUNHO") as StatusPedido;
  const status: StatusPedido = STATUS_PEDIDO.includes(statusForm) ? statusForm : "RASCUNHO";

  const existente = id ? await prisma.pedidoLiberacaoVerbas.findFirst({ where: { id, contratoId } }) : null;
  if (id && !existente) return { erro: "Pedido não encontrado." };
  const documentos: { nome: string; url: string }[] = Array.isArray(existente?.documentos) ? (existente!.documentos as { nome: string; url: string }[]) : [];
  for (const f of formData.getAll("arquivos")) {
    if (f instanceof File && f.size > 0) {
      try {
        const salvo = await salvarArquivo(f);
        documentos.push({ nome: salvo.nome, url: salvo.url });
      } catch (e) {
        return { erro: e instanceof Error ? e.message : "Falha ao salvar documento." };
      }
    }
  }
  const data = { fatoGerador, fatoGeradorOutro: fatoGerador === "OUTRO" ? fatoGeradorOutro : null, competenciaRef, colaboradores, valorSolicitado: r2(valor), dataPedido, protocolo, observacoes, documentos, status };
  const salvo = existente
    ? await prisma.pedidoLiberacaoVerbas.update({ where: { id: existente.id }, data })
    : await prisma.pedidoLiberacaoVerbas.create({ data: { ...data, contratoId, criadoPorId: usuario.id } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: existente ? "ATUALIZAR" : "CRIAR", recurso: "Contrato", recursoId: contratoId, resumo: `Pedido de liberação (${ROTULO_FATO_GERADOR[fatoGerador]}${competenciaRef ? ` · ${rotuloCompetencia(competenciaRef)}` : ""}) R$ ${r2(valor).toFixed(2)} · ${ROTULO_STATUS_PEDIDO[status]}` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: existente ? "Pedido atualizado." : "Pedido registrado.", texto: salvo.id };
}

export async function mudarStatusPedidoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const id = String(formData.get("id") || "");
  const pedido = await prisma.pedidoLiberacaoVerbas.findFirst({ where: { id, contrato: { empresa: { contaId: usuario.contaId } } }, include: { contrato: { select: { id: true, criadoPorId: true } } } });
  if (!pedido) return { erro: "Pedido não encontrado." };
  if (!podeEditarDocumento(usuario, pedido.contrato)) return { erro: mensagemSemPermissao(pedido.contrato) };
  const status = String(formData.get("status") || "") as StatusPedido;
  if (!STATUS_PEDIDO.includes(status)) return { erro: "Status inválido." };
  const valorLiberado = parseNum(formData.get("valorLiberado"));
  const dataLiberacao = parseDia(String(formData.get("dataLiberacao") || ""));
  const protocolo = String(formData.get("protocolo") || "").trim() || pedido.protocolo;
  if ((status === "DEFERIDO" || status === "DEFERIDO_PARCIAL") && (valorLiberado == null || valorLiberado < 0)) return { erro: "Informe o valor liberado." };
  await prisma.pedidoLiberacaoVerbas.update({
    where: { id },
    data: {
      status,
      protocolo,
      valorLiberado: status === "DEFERIDO" || status === "DEFERIDO_PARCIAL" ? r2(valorLiberado as number) : status === "INDEFERIDO" ? 0 : pedido.valorLiberado,
      dataLiberacao: status === "DEFERIDO" || status === "DEFERIDO_PARCIAL" ? dataLiberacao ?? new Date() : pedido.dataLiberacao,
    },
  });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Contrato", recursoId: pedido.contratoId, resumo: `Pedido de liberação (${ROTULO_FATO_GERADOR[pedido.fatoGerador as FatoGerador]}) → ${ROTULO_STATUS_PEDIDO[status]}${valorLiberado != null ? ` · liberado R$ ${r2(valorLiberado).toFixed(2)}` : ""}` });
  revalidatePath(`/contratos/${pedido.contratoId}`);
  return { ok: true, mensagem: `Pedido ${ROTULO_STATUS_PEDIDO[status].toLowerCase()}.` };
}

export async function excluirPedidoLiberacaoAction(id: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const pedido = await prisma.pedidoLiberacaoVerbas.findFirst({ where: { id, contrato: { empresa: { contaId: usuario.contaId } } }, include: { contrato: { select: { id: true, criadoPorId: true } } } });
  if (!pedido) return { erro: "Pedido não encontrado." };
  if (!podeEditarDocumento(usuario, pedido.contrato)) return { erro: mensagemSemPermissao(pedido.contrato) };
  await prisma.pedidoLiberacaoVerbas.delete({ where: { id } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "EXCLUIR", recurso: "Contrato", recursoId: pedido.contratoId, resumo: `Pedido de liberação (${ROTULO_FATO_GERADOR[pedido.fatoGerador as FatoGerador]}) R$ ${pedido.valorSolicitado.toFixed(2)} excluído` });
  revalidatePath(`/contratos/${pedido.contratoId}`);
  return { ok: true, mensagem: "Pedido excluído." };
}

export async function gerarMinutaLiberacaoAction(pedidoId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const pedido = await prisma.pedidoLiberacaoVerbas.findFirst({ where: { id: pedidoId, contrato: { empresa: { contaId: usuario.contaId } } } });
  if (!pedido) return { erro: "Pedido não encontrado." };
  const contrato = await contratoDaConta(pedido.contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  if (!temGarantiaVerbas(contrato.garantiaVerbas)) return { erro: "Defina a garantia de verbas trabalhistas do contrato (conta vinculada ou fato gerador) antes de gerar a minuta." };
  try {
    const resumo = await resumoContaVinculada(contrato.id);
    const texto = await gerarMinutaLiberacao({
      empresa: contrato.empresa.razaoSocial || contrato.empresa.nomeFantasia || "a contratada",
      contratoNumero: contrato.numero,
      orgao: contrato.orgaoNome,
      objeto: contrato.objeto,
      regimeLegal: contrato.regimeLegal === "OUTRO" ? contrato.regimeLegalOutro || "regime próprio" : contrato.regimeLegal ? ROTULO_REGIME[contrato.regimeLegal] : "não informado no cadastro",
      garantia: contrato.garantiaVerbas,
      fatoGerador: pedido.fatoGerador === "OUTRO" ? pedido.fatoGeradorOutro || "Outro" : ROTULO_FATO_GERADOR[pedido.fatoGerador as FatoGerador],
      competenciaRef: pedido.competenciaRef ? rotuloCompetencia(pedido.competenciaRef) : null,
      colaboradores: pedido.colaboradores,
      valor: pedido.valorSolicitado,
      saldoEstimado: resumo?.saldo.saldo ?? 0,
      documentos: Array.isArray(pedido.documentos) ? (pedido.documentos as { nome: string }[]).map((d) => d.nome) : [],
      observacoes: pedido.observacoes,
    });
    await prisma.pedidoLiberacaoVerbas.update({ where: { id: pedidoId }, data: { minuta: texto } });
    await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "CRIAR", recurso: "Contrato", recursoId: contrato.id, resumo: `Minuta de pedido de liberação (${ROTULO_FATO_GERADOR[pedido.fatoGerador as FatoGerador]}) gerada pela IA` });
    revalidatePath(`/contratos/${contrato.id}`);
    return { ok: true, texto };
  } catch (err) {
    const { avisarFalhaDeIa, ehFalhaDeCredito, mensagemParaCliente } = await import("@/lib/falhaIa");
    await avisarFalhaDeIa("minuta de pedido de liberação (conta vinculada)", err);
    return { erro: ehFalhaDeCredito(err) ? mensagemParaCliente() : err instanceof Error ? err.message : "Falha ao gerar a minuta." };
  }
}

export async function salvarMinutaLiberacaoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const id = String(formData.get("id") || "");
  const pedido = await prisma.pedidoLiberacaoVerbas.findFirst({ where: { id, contrato: { empresa: { contaId: usuario.contaId } } }, include: { contrato: { select: { id: true, criadoPorId: true } } } });
  if (!pedido) return { erro: "Pedido não encontrado." };
  if (!podeEditarDocumento(usuario, pedido.contrato)) return { erro: mensagemSemPermissao(pedido.contrato) };
  await prisma.pedidoLiberacaoVerbas.update({ where: { id }, data: { minuta: String(formData.get("minuta") || "").trim() || null } });
  revalidatePath(`/contratos/${pedido.contratoId}`);
  return { ok: true, mensagem: "Minuta salva." };
}

// ─────────────────────────────────────────────
// Extratos (RN04)
// ─────────────────────────────────────────────

export async function registrarExtratoAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await contratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const dataSaldo = parseDia(String(formData.get("dataSaldo") || ""));
  if (!dataSaldo) return { erro: "Informe a data do saldo." };
  const saldoBanco = parseNum(formData.get("saldoBanco"));
  if (saldoBanco == null || saldoBanco < 0) return { erro: "Informe o saldo do extrato." };
  const rendimentos = parseNum(formData.get("rendimentos"));
  const observacao = String(formData.get("observacao") || "").trim() || null;
  let arquivoUrl: string | null = null;
  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    try {
      arquivoUrl = (await salvarArquivo(arquivo)).url;
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Falha ao salvar o extrato." };
    }
  }
  await prisma.extratoContaVinculada.create({ data: { contratoId, dataSaldo, saldoBanco: r2(saldoBanco), rendimentos: rendimentos != null ? r2(rendimentos) : null, arquivoUrl, observacao, criadoPorId: usuario.id } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "CRIAR", recurso: "Contrato", recursoId: contratoId, resumo: `Extrato da conta vinculada em ${dataSaldo.toLocaleDateString("pt-BR", { timeZone: "UTC" })}: saldo R$ ${r2(saldoBanco).toFixed(2)}${rendimentos != null ? ` · rendimentos R$ ${r2(rendimentos).toFixed(2)}` : ""}` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: "Extrato registrado." };
}

export async function excluirExtratoAction(id: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const e = await prisma.extratoContaVinculada.findFirst({ where: { id, contrato: { empresa: { contaId: usuario.contaId } } }, include: { contrato: { select: { id: true, criadoPorId: true } } } });
  if (!e) return { erro: "Extrato não encontrado." };
  if (!podeEditarDocumento(usuario, e.contrato)) return { erro: mensagemSemPermissao(e.contrato) };
  await prisma.extratoContaVinculada.delete({ where: { id } });
  revalidatePath(`/contratos/${e.contratoId}`);
  return { ok: true, mensagem: "Extrato excluído." };
}
