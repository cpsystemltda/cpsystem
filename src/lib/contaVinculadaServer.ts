import "server-only";
import { prisma } from "@/lib/prisma";
import { colaboradoresNecessarios } from "@/lib/maoDeObra";
import { derivadosDaPlanilha, ehModulo, type LinhaPlanilha } from "@/lib/planilhaCustos";
import { diaUtc, itensVigentesEm } from "@/lib/competencias";
import {
  CHAVE_PARAMETRO_PERCENTUAIS,
  PERCENTUAIS_ANEXO_XII,
  alertasContaVinculada,
  percentuaisDe,
  ratDe,
  retencaoEstimada,
  retencaoEfetiva,
  saldoContaVinculada,
  totalPct,
  type AlertaContaVinculada,
  type FuncaoParaRetencao,
  type PercentuaisContaVinculada,
  type Rat,
} from "@/lib/contaVinculada";

/**
 * Conta vinculada (ESP-006) — lado do servidor: percentuais (admin ou do
 * contrato), estimativa por competência a partir das planilhas de custos,
 * saldo, pedidos, extratos e alertas.
 */

export async function percentuaisPadrao(): Promise<PercentuaisContaVinculada> {
  const p = await prisma.parametroPlataforma.findUnique({ where: { chave: CHAVE_PARAMETRO_PERCENTUAIS } });
  return percentuaisDe(p?.valor ?? null);
}

export async function percentuaisDoContrato(contrato: { percentuaisContaVinculada: unknown }): Promise<{ percentuais: PercentuaisContaVinculada; fonte: "CONTRATO" | "PADRAO" }> {
  const padrao = await percentuaisPadrao();
  if (contrato.percentuaisContaVinculada && typeof contrato.percentuaisContaVinculada === "object") {
    return { percentuais: percentuaisDe(contrato.percentuaisContaVinculada, padrao), fonte: "CONTRATO" };
  }
  return { percentuais: padrao, fonte: "PADRAO" };
}

export function temGarantiaVerbas(g: string | null | undefined): g is "CONTA_VINCULADA" | "FATO_GERADOR" {
  return g === "CONTA_VINCULADA" || g === "FATO_GERADOR";
}

/** Funções (postos) do período com o salário-base da planilha de custos vigente. */
export async function funcoesParaRetencao(contratoId: string, vigenciaId: string | null, periodoFim: Date): Promise<FuncaoParaRetencao[]> {
  const itens = await prisma.contratoItem.findMany({
    where: { contratoId, ...(vigenciaId ? { vigenciaId } : {}) },
    select: { id: true, descricao: true, quantidade: true, unidadeMaoDeObra: true, colaboradoresPorPosto: true, vigenteDe: true, vigenteAte: true, substituiItemId: true },
    orderBy: { descricao: "asc" },
  });
  const vigentes = itensVigentesEm(itens, periodoFim);
  if (vigentes.length === 0) return [];
  // Posto versionado por aditivo (ESP-002 RN07) herda a planilha do item que
  // substituiu — a função é a mesma; só mudou quantidade ou valor.
  const porIdTodos = new Map(itens.map((i) => [i.id, i]));
  const cadeia = (id: string): string[] => {
    const out = [id];
    let atual = porIdTodos.get(id);
    for (let k = 0; k < 6 && atual?.substituiItemId; k++) {
      out.push(atual.substituiItemId);
      atual = porIdTodos.get(atual.substituiItemId);
    }
    return out;
  };
  const idsBusca = [...new Set(vigentes.flatMap((i) => cadeia(i.id)))];
  const planilhas = await prisma.planilhaCustos.findMany({
    where: { contratoId, contratoItemId: { in: idsBusca }, dataEfeito: { lte: new Date(diaUtc(periodoFim).getTime() + 86_400_000) } },
    orderBy: [{ dataEfeito: "desc" }, { versao: "desc" }],
    include: { linhas: { orderBy: { ordem: "asc" } } },
  });
  const porItem = new Map<string, number | null>();
  for (const p of planilhas) {
    if (!p.contratoItemId || porItem.has(p.contratoItemId)) continue;
    const linhas: LinhaPlanilha[] = p.linhas.map((l) => ({ modulo: ehModulo(l.modulo) ? l.modulo : "OUTROS", descricao: l.descricao, percentual: l.percentual, valor: l.valor }));
    porItem.set(p.contratoItemId, derivadosDaPlanilha(linhas).salarioBase);
  }
  return vigentes.map((i) => {
    const idComPlanilha = cadeia(i.id).find((id) => porItem.has(id));
    return { itemId: i.id, funcao: i.descricao, salarioBase: idComPlanilha ? porItem.get(idComPlanilha) ?? null : null, colaboradores: colaboradoresNecessarios(i) };
  });
}

/**
 * RN03: grava a retenção estimada da competência (por rubrica e por função).
 * Devolve null quando o contrato não tem conta vinculada/fato gerador.
 */
export async function estimarRetencaoDaCompetencia(competenciaId: string): Promise<{ total: number; semPlanilha: string[] } | null> {
  const c = await prisma.competencia.findUnique({
    where: { id: competenciaId },
    select: {
      id: true,
      contratoId: true,
      vigenciaId: true,
      tipo: true,
      periodoFim: true,
      diasPeriodo: true,
      diasBase: true,
      contrato: { select: { garantiaVerbas: true, ratPct: true, percentuaisContaVinculada: true } },
    },
  });
  if (!c || !temGarantiaVerbas(c.contrato.garantiaVerbas) || c.tipo !== "REGULAR") return null;
  const { percentuais, fonte } = await percentuaisDoContrato(c.contrato);
  const rat = ratDe(c.contrato.ratPct);
  const funcoes = await funcoesParaRetencao(c.contratoId, c.vigenciaId, c.periodoFim);
  const fator = c.diasBase > 0 ? Math.min(1, c.diasPeriodo / c.diasBase) : 1;
  const r = retencaoEstimada(funcoes, percentuais, rat, fator);
  await prisma.competencia.update({
    where: { id: c.id },
    data: {
      retencaoCvEstimada: r.total,
      retencaoCvDetalhe: { porRubrica: r.porRubrica, funcoes: r.detalhe, semPlanilha: r.semPlanilha, percentuais, rat, fonte, fator, totalPct: totalPct(percentuais, rat) },
    },
  });
  return { total: r.total, semPlanilha: r.semPlanilha };
}

/**
 * Recalcula a estimativa de todas as competências sem valor informado —
 * inclusive as já pagas: é delas que sai o saldo (o informado, quando
 * existe, prevalece e não é tocado).
 */
export async function recalcularRetencoesDoContrato(contratoId: string): Promise<number> {
  const comps = await prisma.competencia.findMany({
    where: { contratoId, tipo: "REGULAR", retencaoCvInformada: null },
    select: { id: true },
  });
  let n = 0;
  for (const c of comps) {
    if (await estimarRetencaoDaCompetencia(c.id)) n++;
  }
  return n;
}

// ─────────────────────────────────────────────
// Resumo para a aba
// ─────────────────────────────────────────────

export type ResumoContaVinculada = {
  garantia: string | null;
  garantiaOutra: string | null;
  fatoGerador: boolean;
  rat: Rat;
  percentuais: PercentuaisContaVinculada;
  fontePercentuais: "CONTRATO" | "PADRAO";
  totalPct: number;
  prazoAlertaDias: number;
  retencoes: { id: string; competencia: string; tipo: string; status: string; estimada: number | null; informada: number | null; efetiva: number; semPlanilha: string[] }[];
  saldo: { retido: number; aReter: number; liberado: number; rendimentos: number; saldo: number };
  ultimoExtrato: { id: string; dataSaldo: string; saldoBanco: number } | null;
  diferenca: number | null;
  extratos: { id: string; dataSaldo: string; saldoBanco: number; rendimentos: number | null; arquivoUrl: string | null; observacao: string | null }[];
  pedidos: {
    id: string;
    fatoGerador: string;
    fatoGeradorOutro: string | null;
    competenciaRef: string | null;
    colaboradores: string | null;
    valorSolicitado: number;
    documentos: { nome: string; url: string }[];
    dataPedido: string;
    protocolo: string | null;
    status: string;
    valorLiberado: number | null;
    dataLiberacao: string | null;
    observacoes: string | null;
    minuta: string | null;
  }[];
  alertas: AlertaContaVinculada[];
  encerramento: { ativo: boolean; diasParaFim: number; pendencias: string[] };
  retidoNoAno: number;
};

export async function resumoContaVinculada(contratoId: string, hoje = new Date()): Promise<ResumoContaVinculada | null> {
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: {
      garantiaVerbas: true,
      garantiaVerbasOutra: true,
      ratPct: true,
      percentuaisContaVinculada: true,
      prazoAlertaLiberacaoDias: true,
      vigenciaFim: true,
      competencias: {
        where: { tipo: "REGULAR" },
        orderBy: { competencia: "desc" },
        select: { id: true, competencia: true, tipo: true, status: true, retencaoCvEstimada: true, retencaoCvInformada: true, retencaoCvDetalhe: true },
      },
      pedidosLiberacao: { orderBy: { dataPedido: "desc" } },
      extratosContaVinculada: { orderBy: { dataSaldo: "desc" } },
    },
  });
  if (!contrato) return null;
  const { percentuais, fonte } = await percentuaisDoContrato(contrato);
  const rat = ratDe(contrato.ratPct);
  const fatoGerador = contrato.garantiaVerbas === "FATO_GERADOR";
  const retencoes = contrato.competencias.map((c) => {
    const det = c.retencaoCvDetalhe as { semPlanilha?: string[] } | null;
    return {
      id: c.id,
      competencia: c.competencia,
      tipo: c.tipo,
      status: c.status,
      estimada: c.retencaoCvEstimada,
      informada: c.retencaoCvInformada,
      efetiva: retencaoEfetiva({ competencia: c.competencia, status: c.status, estimada: c.retencaoCvEstimada, informada: c.retencaoCvInformada }),
      semPlanilha: det?.semPlanilha ?? [],
    };
  });
  const rendimentos = contrato.extratosContaVinculada.reduce((s, e) => s + (e.rendimentos ?? 0), 0);
  const saldo = saldoContaVinculada({ retencoes, liberacoes: contrato.pedidosLiberacao, rendimentos });
  const ultimo = contrato.extratosContaVinculada[0] ?? null;
  const ano = String(hoje.getUTCFullYear());
  const retidoNoAno = Math.round(retencoes.filter((r) => r.status === "PAGA" && r.competencia.startsWith(ano)).reduce((s, r) => s + r.efetiva, 0) * 100) / 100;
  const alertas = temGarantiaVerbas(contrato.garantiaVerbas)
    ? alertasContaVinculada({ hoje, prazoDias: contrato.prazoAlertaLiberacaoDias, pedidos: contrato.pedidosLiberacao, retidoNoAno, vigenciaFim: contrato.vigenciaFim, saldo: saldo.saldo, fatoGerador })
    : [];
  const diasParaFim = Math.ceil((contrato.vigenciaFim.getTime() - hoje.getTime()) / 86_400_000);
  const abertos = contrato.pedidosLiberacao.filter((p) => p.status === "PROTOCOLADO" || p.status === "EM_ANALISE").length;
  const pendencias: string[] = [];
  if (diasParaFim <= 60) {
    if (saldo.saldo > 0) pendencias.push(`${fatoGerador ? "Provisionado não pago" : "Saldo remanescente"}: R$ ${saldo.saldo.toFixed(2)} — situação "a resgatar".`);
    if (abertos > 0) pendencias.push(`${abertos} pedido(s) de liberação em análise.`);
    pendencias.push("Rescisões pendentes de comprovação: conferir com o RH (o cadastro de colaboradores entra na ESP-008).");
  }
  return {
    garantia: contrato.garantiaVerbas,
    garantiaOutra: contrato.garantiaVerbasOutra,
    fatoGerador,
    rat,
    percentuais,
    fontePercentuais: fonte,
    totalPct: totalPct(percentuais, rat),
    prazoAlertaDias: contrato.prazoAlertaLiberacaoDias ?? 30,
    retencoes,
    saldo,
    ultimoExtrato: ultimo ? { id: ultimo.id, dataSaldo: ultimo.dataSaldo.toISOString(), saldoBanco: ultimo.saldoBanco } : null,
    diferenca: ultimo ? Math.round((saldo.saldo - ultimo.saldoBanco) * 100) / 100 : null,
    extratos: contrato.extratosContaVinculada.map((e) => ({ id: e.id, dataSaldo: e.dataSaldo.toISOString(), saldoBanco: e.saldoBanco, rendimentos: e.rendimentos, arquivoUrl: e.arquivoUrl, observacao: e.observacao })),
    pedidos: contrato.pedidosLiberacao.map((p) => ({
      id: p.id,
      fatoGerador: p.fatoGerador,
      fatoGeradorOutro: p.fatoGeradorOutro,
      competenciaRef: p.competenciaRef,
      colaboradores: p.colaboradores,
      valorSolicitado: p.valorSolicitado,
      documentos: Array.isArray(p.documentos) ? (p.documentos as { nome: string; url: string }[]) : [],
      dataPedido: p.dataPedido.toISOString(),
      protocolo: p.protocolo,
      status: p.status,
      valorLiberado: p.valorLiberado,
      dataLiberacao: p.dataLiberacao ? p.dataLiberacao.toISOString() : null,
      observacoes: p.observacoes,
      minuta: p.minuta,
    })),
    alertas,
    encerramento: { ativo: diasParaFim <= 60, diasParaFim, pendencias },
    retidoNoAno,
  };
}

/** Dashboard: saldo somado das contas vinculadas (e provisionado não pago) da conta. */
export async function saldoContasVinculadasDaConta(filtro: { contaId: string; id?: string }): Promise<{ contaVinculada: number; provisionado: number; contratos: number }> {
  const contratos = await prisma.contrato.findMany({
    where: { empresa: filtro, garantiaVerbas: { in: ["CONTA_VINCULADA", "FATO_GERADOR"] } },
    select: {
      garantiaVerbas: true,
      competencias: { where: { tipo: "REGULAR" }, select: { competencia: true, status: true, retencaoCvEstimada: true, retencaoCvInformada: true } },
      pedidosLiberacao: { select: { status: true, valorLiberado: true } },
      extratosContaVinculada: { select: { rendimentos: true } },
    },
  });
  let contaVinculada = 0;
  let provisionado = 0;
  for (const c of contratos) {
    const s = saldoContaVinculada({
      retencoes: c.competencias.map((k) => ({ competencia: k.competencia, status: k.status, estimada: k.retencaoCvEstimada, informada: k.retencaoCvInformada })),
      liberacoes: c.pedidosLiberacao,
      rendimentos: c.extratosContaVinculada.reduce((s2, e) => s2 + (e.rendimentos ?? 0), 0),
    });
    if (c.garantiaVerbas === "FATO_GERADOR") provisionado += s.saldo;
    else contaVinculada += s.saldo;
  }
  return { contaVinculada: Math.round(contaVinculada * 100) / 100, provisionado: Math.round(provisionado * 100) / 100, contratos: contratos.length };
}

export { PERCENTUAIS_ANEXO_XII };
