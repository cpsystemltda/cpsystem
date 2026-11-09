import "server-only";
import { prisma } from "@/lib/prisma";
import { isContratoMaoDeObra } from "@/lib/validators";
import { estimarRetencaoDaCompetencia } from "@/lib/contaVinculadaServer";
import { criarItensDaCompetencia } from "@/lib/checklistMensalServer";
import { situacaoChecklist } from "@/lib/checklistMensal";
import {
  ETAPAS,
  calcularFaturado,
  diaUtc,
  diasDeAtraso,
  empenhoInsuficiente,
  faturadaOuAlem,
  indiceStatus,
  periodosDaVigencia,
  prazoDePagamento,
  valorPrevistoComVersoes,
  versoesDeValorMensal,
  type Periodo,
  type StatusCompetencia,
} from "@/lib/competencias";

/**
 * Competências mensais (ESP-004) — lado do servidor: planeja os períodos de
 * cada vigência do contrato de mão de obra, cria o que falta, recalcula
 * previstos quando os postos mudam e monta o resumo que as telas mostram.
 */

export type ContextoCompetencias = NonNullable<Awaited<ReturnType<typeof carregarContextoCompetencias>>>;

export async function carregarContextoCompetencias(contratoId: string) {
  const c = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: {
      id: true,
      numero: true,
      tipo: true,
      valoresMensaisConfirmadosEm: true,
      cicloCompetencia: true,
      criterioProRata: true,
      diaFechamentoCompetencia: true,
      termoInicialPagamento: true,
      prazoPagamentoDias: true,
      retencoesPadrao: true,
      competenciasRetroativasEm: true,
      competenciasRetroativasGerar: true,
      suspensaoInicio: true,
      suspensaoFim: true,
      vigencias: {
        orderBy: { ordem: "asc" },
        select: {
          id: true,
          ordem: true,
          dataInicio: true,
          dataFim: true,
          contratoItens: { select: { quantidade: true, valorUnitario: true, vigenteDe: true, vigenteAte: true } },
        },
      },
    },
  });
  if (!c) return null;
  return c;
}

export function contratoGeraCompetencias(c: { tipo: string; valoresMensaisConfirmadosEm: Date | null }): boolean {
  return isContratoMaoDeObra(c.tipo) && !!c.valoresMensaisConfirmadosEm;
}

export type CompetenciaPlanejada = {
  vigenciaId: string;
  periodo: Periodo;
  valorPrevisto: number;
  valorMensalBase: number;
};

function dentroDaSuspensao(p: Periodo, ini: Date | null, fim: Date | null): boolean {
  if (!ini) return false;
  const a = diaUtc(ini);
  const b = fim ? diaUtc(fim) : null;
  // RN10: período inteiramente dentro da suspensão não nasce.
  return p.inicio >= a && (b == null || p.fim <= b);
}

/** Vigência em curso em `hoje`; sem nenhuma em curso, a última. */
export function vigenciaAtualId(ctx: ContextoCompetencias, hoje: Date): string | null {
  const h = diaUtc(hoje);
  const emCurso = ctx.vigencias.find((v) => diaUtc(v.dataInicio) <= h && h <= diaUtc(v.dataFim));
  if (emCurso) return emCurso.id;
  const ultima = ctx.vigencias.reduce<ContextoCompetencias["vigencias"][number] | null>((a, b) => (!a || b.ordem > a.ordem ? b : a), null);
  return ultima?.id ?? null;
}

/**
 * Períodos de todas as vigências, com valor previsto pela versão de itens
 * aplicável. Vigência sem postos cadastrados (valor zero — caso das vigências
 * antigas de contrato importado no meio do caminho) não gera competência.
 */
export function planoDeCompetencias(ctx: ContextoCompetencias): CompetenciaPlanejada[] {
  const out: CompetenciaPlanejada[] = [];
  for (const v of ctx.vigencias) {
    if (v.contratoItens.length === 0) continue;
    const periodos = periodosDaVigencia({
      inicio: v.dataInicio,
      fim: v.dataFim,
      ciclo: ctx.cicloCompetencia,
      diaFechamento: ctx.diaFechamentoCompetencia,
    });
    const versoes = versoesDeValorMensal(v.contratoItens, v.dataInicio, v.dataFim);
    for (const p of periodos) {
      if (dentroDaSuspensao(p, ctx.suspensaoInicio, ctx.suspensaoFim)) continue;
      const { valor, valorMensalBase } = valorPrevistoComVersoes(p, versoes, ctx.criterioProRata);
      out.push({ vigenciaId: v.id, periodo: p, valorPrevisto: valor, valorMensalBase });
    }
  }
  return out;
}

/**
 * Períodos já iniciados até `ate` que ainda não têm competência REGULAR —
 * só da vigência em curso (RN08 fala "desta vigência"; vigências passadas
 * ficam como consulta, não viram competência retroativa).
 */
export async function competenciasFaltantes(ctx: ContextoCompetencias, ate: Date): Promise<CompetenciaPlanejada[]> {
  const vigId = vigenciaAtualId(ctx, ate);
  if (!vigId) return [];
  const existentes = await prisma.competencia.findMany({
    where: { contratoId: ctx.id, tipo: "REGULAR" },
    select: { vigenciaId: true, competencia: true },
  });
  const chave = new Set(existentes.map((e) => `${e.vigenciaId ?? ""}|${e.competencia}`));
  const limite = diaUtc(ate);
  return planoDeCompetencias(ctx).filter((p) => p.vigenciaId === vigId && p.periodo.inicio <= limite && !chave.has(`${p.vigenciaId}|${p.periodo.competencia}`));
}

/** RN08: há meses já transcorridos sem competência e a pessoa ainda não decidiu. */
export async function precisaDecidirRetroativas(ctx: ContextoCompetencias, hoje: Date): Promise<boolean> {
  if (!contratoGeraCompetencias(ctx) || ctx.competenciasRetroativasEm) return false;
  const faltantes = await competenciasFaltantes(ctx, hoje);
  const h = diaUtc(hoje);
  return faltantes.some((f) => f.periodo.fim < h);
}

export async function gerarCompetencias(
  ctx: ContextoCompetencias,
  opts: { hoje: Date; somenteCorrente: boolean; statusPassadas?: StatusCompetencia; criadoPorId?: string | null },
): Promise<{ id: string; competencia: string; valorPrevisto: number; status: StatusCompetencia }[]> {
  if (!contratoGeraCompetencias(ctx)) return [];
  const h = diaUtc(opts.hoje);
  let faltantes = await competenciasFaltantes(ctx, opts.hoje);
  if (opts.somenteCorrente) faltantes = faltantes.filter((f) => f.periodo.inicio <= h && f.periodo.fim >= h);
  const criadas: { id: string; competencia: string; valorPrevisto: number; status: StatusCompetencia }[] = [];
  for (const f of faltantes) {
    const passada = f.periodo.fim < h;
    const status: StatusCompetencia = passada ? opts.statusPassadas ?? "A_CONFIRMAR" : "EM_EXECUCAO";
    const c = await prisma.competencia.create({
      data: {
        contratoId: ctx.id,
        vigenciaId: f.vigenciaId,
        tipo: "REGULAR",
        competencia: f.periodo.competencia,
        periodoInicio: f.periodo.inicio,
        periodoFim: f.periodo.fim,
        diasPeriodo: f.periodo.diasPeriodo,
        diasBase: f.periodo.diasBase,
        valorMensalBase: f.valorMensalBase,
        valorPrevisto: f.valorPrevisto,
        status,
        criadaAutomaticamente: !opts.criadoPorId,
        criadoPorId: opts.criadoPorId ?? null,
      },
      select: { id: true, competencia: true, valorPrevisto: true, status: true },
    });
    // ESP-006 RN03: a competência já nasce com a retenção estimada da conta
    // vinculada (quando o contrato tem). Falha aqui não impede a criação.
    await estimarRetencaoDaCompetencia(c.id).catch((e) => console.warn("[competencias] estimativa da conta vinculada falhou:", e));
    // ESP-009 RN01: o checklist mensal nasce com a competência.
    await criarItensDaCompetencia(c.id).catch((e) => console.warn("[competencias] checklist mensal falhou:", e));
    criadas.push(c);
  }
  return criadas;
}

/**
 * Depois de um aditivo de postos (ESP-002 RN07): competências ainda não
 * faturadas cujo período alcança a data de efeito ganham o previsto novo.
 */
export async function recalcularPrevistos(contratoId: string, aPartirDe: Date): Promise<number> {
  const ctx = await carregarContextoCompetencias(contratoId);
  if (!ctx) return 0;
  const plano = planoDeCompetencias(ctx);
  const porChave = new Map(plano.map((p) => [`${p.vigenciaId}|${p.periodo.competencia}`, p]));
  const abertas = await prisma.competencia.findMany({
    where: { contratoId, tipo: "REGULAR", periodoFim: { gte: diaUtc(aPartirDe) }, status: { in: ["A_CONFIRMAR", "EM_EXECUCAO", "MEDICAO", "DOC_TRABALHISTA"] } },
    select: { id: true, vigenciaId: true, competencia: true, valorPrevisto: true },
  });
  let n = 0;
  for (const c of abertas) {
    const p = porChave.get(`${c.vigenciaId ?? ""}|${c.competencia}`);
    if (!p || Math.abs(p.valorPrevisto - c.valorPrevisto) < 0.005) continue;
    await prisma.competencia.update({ where: { id: c.id }, data: { valorPrevisto: p.valorPrevisto, valorMensalBase: p.valorMensalBase } });
    n++;
  }
  return n;
}

/** Rotina diária (RN01): abre a competência corrente de cada CMO confirmado. */
export async function rodarGeracaoDiaria(hoje = new Date()): Promise<{ contratos: number; criadas: number; detalhes: string[] }> {
  const contratos = await prisma.contrato.findMany({
    where: {
      tipo: { in: ["SERVICOS_DEDICACAO_EXCLUSIVA", "SERVICOS_PREDOMINANCIA_MAO_DE_OBRA"] },
      valoresMensaisConfirmadosEm: { not: null },
      vigenciaFim: { gte: new Date(hoje.getTime() - 45 * 86_400_000) },
    },
    select: { id: true },
  });
  let criadas = 0;
  const detalhes: string[] = [];
  for (const { id } of contratos) {
    const ctx = await carregarContextoCompetencias(id);
    if (!ctx) continue;
    try {
      // Sem a decisão da RN08 só nasce a corrente; com ela, tudo que faltar
      // até hoje (o que já passou entra "a confirmar").
      const novas = await gerarCompetencias(ctx, { hoje, somenteCorrente: !ctx.competenciasRetroativasEm });
      criadas += novas.length;
      if (novas.length) detalhes.push(`Contrato ${ctx.numero}: ${novas.map((n) => n.competencia).join(", ")}`);
    } catch (e) {
      detalhes.push(`Contrato ${ctx.numero}: falhou (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return { contratos: contratos.length, criadas, detalhes };
}

// ─────────────────────────────────────────────
// Empenhos (RN06)
// ─────────────────────────────────────────────

export type EmpenhoResumo = { id: string; numero: string; instrumento: string; valorTotal: number; comprometido: number; saldo: number };

/** Valor do empenho (soma dos itens) e o quanto as competências já comprometem dele. */
export async function empenhosDoContratoComSaldo(contratoId: string): Promise<EmpenhoResumo[]> {
  const empenhos = await prisma.empenho.findMany({
    where: { contratoId },
    orderBy: { dataEmissao: "desc" },
    select: {
      id: true,
      numero: true,
      instrumento: true,
      itens: { select: { valorTotal: true } },
      competencias: {
        select: {
          valor: true,
          competencia: { select: { valorPrevisto: true, valorGlosas: true, ajustes: true, valorFaturado: true } },
        },
      },
    },
  });
  return empenhos.map((e) => {
    const valorTotal = Math.round(e.itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100;
    const comprometido =
      Math.round(
        e.competencias.reduce((s, ce) => {
          const c = ce.competencia;
          const vale = ce.valor ?? c.valorFaturado ?? calcularFaturado(c.valorPrevisto, c.valorGlosas, c.ajustes);
          return s + vale;
        }, 0) * 100,
      ) / 100;
    return { id: e.id, numero: e.numero, instrumento: e.instrumento, valorTotal, comprometido, saldo: Math.round((valorTotal - comprometido) * 100) / 100 };
  });
}

// ─────────────────────────────────────────────
// Resumo para as telas
// ─────────────────────────────────────────────

export type ResumoCompetencia = {
  id: string;
  contratoId: string;
  vigenciaId: string | null;
  contratoNumero: string;
  orgaoNome: string;
  tipo: "REGULAR" | "COMPLEMENTAR";
  competencia: string;
  periodoInicio: string;
  periodoFim: string;
  diasPeriodo: number;
  diasBase: number;
  status: StatusCompetencia;
  valorMensalBase: number;
  valorPrevisto: number;
  valorGlosas: number;
  ajustes: number;
  ajustesJustificativa: string | null;
  /** Faturado fixado na NF, ou o previsto − glosas ± ajustes enquanto não há NF. */
  valorFaturado: number;
  faturadoFixado: boolean;
  retencoes: { codigo: string; rotulo: string; pct: number | null; valor: number }[];
  valorRetencoes: number;
  valorLiquidoEsperado: number;
  valorRecebido: number | null;
  numeroNf: string | null;
  prazoPagamento: string | null;
  atrasoDias: number;
  pagaComAtraso: boolean;
  datas: Record<string, string | null>;
  responsaveis: Record<string, string | null>;
  arquivos: Record<string, string | null>;
  empenhos: { id: string; numero: string; instrumento: string; valor: number | null; saldo: number; valorTotal: number }[];
  empenhoInsuficiente: boolean;
  complementarRef: string | null;
  complementarDetalhe: unknown;
  criadaAutomaticamente: boolean;
  observacoes: string | null;
  /** ESP-005: glosas da competência e pontuação do IMR. */
  glosas: GlosaDto[];
  imrPontuacoes: { indicadorId: string; pontuacao: number; percentualPagamento: number | null }[];
  /** ESP-006: garantia de verbas do contrato e retenção da conta vinculada. */
  garantiaVerbas: string | null;
  retencaoCv: { estimada: number | null; informada: number | null; detalhe: unknown };
  /** ESP-009: situação do checklist mensal. */
  docs: { itens: number; obrigatorios: number; pendentes: number; completo: boolean; devolvido: boolean };
};

export type GlosaDto = {
  id: string;
  data: string;
  tipo: string;
  status: string;
  valor: number;
  motivo: string;
  arquivoUrl: string | null;
  contratoItemId: string | null;
  itemDescricao: string | null;
  competenciaOrigemRef: string | null;
  contestacao: string | null;
  contestadaEm: string | null;
  decididaEm: string | null;
  complementarId: string | null;
};

type CompetenciaRow = Awaited<ReturnType<typeof buscarCompetencias>>[number];

async function buscarCompetencias(where: { contratoId?: string; id?: string; contrato?: { empresa: { contaId: string; id?: string } } }) {
  return prisma.competencia.findMany({
    where,
    orderBy: [{ competencia: "desc" }, { tipo: "asc" }, { criadoEm: "desc" }],
    include: {
      contrato: { select: { id: true, numero: true, orgaoNome: true, termoInicialPagamento: true, prazoPagamentoDias: true, garantiaVerbas: true } },
      empenhos: { select: { empenhoId: true, valor: true, empenho: { select: { numero: true, instrumento: true } } } },
      glosas: { orderBy: [{ data: "asc" }, { criadoEm: "asc" }], include: { contratoItem: { select: { descricao: true } } } },
      itensChecklist: { select: { obrigatorio: true, status: true } },
    },
  });
}

function montarResumo(c: CompetenciaRow, saldos: Map<string, EmpenhoResumo>, hoje: Date): ResumoCompetencia {
  const faturadoFixado = c.valorFaturado != null;
  const valorFaturado = c.valorFaturado ?? calcularFaturado(c.valorPrevisto, c.valorGlosas, c.ajustes);
  const retencoes = Array.isArray(c.retencoes) ? (c.retencoes as ResumoCompetencia["retencoes"]) : [];
  const liquido = c.valorLiquidoEsperado ?? Math.round((valorFaturado - c.valorRetencoes) * 100) / 100;
  const prazo =
    c.prazoPagamento ??
    prazoDePagamento({
      termoInicial: c.contrato.termoInicialPagamento,
      prazoDias: c.contrato.prazoPagamentoDias,
      dataAteste: c.dataAteste,
      dataNfEncaminhada: c.dataNfEncaminhada,
      dataNfEmitida: c.dataNfEmitida,
    });
  const referencia = c.dataPagamento ?? hoje;
  const atraso = diasDeAtraso(prazo, referencia);
  const empenhos = c.empenhos.map((ce) => {
    const s = saldos.get(ce.empenhoId);
    return { id: ce.empenhoId, numero: ce.empenho.numero, instrumento: ce.empenho.instrumento, valor: ce.valor, saldo: s?.saldo ?? 0, valorTotal: s?.valorTotal ?? 0 };
  });
  // RN06: o saldo do empenho já desconta esta competência; para saber se ele
  // cobre, devolvemos a parte dela ao saldo antes de comparar.
  let insuficiente = false;
  if (empenhos.length > 0 && !faturadaOuAlem(c.status) && c.status !== "PAGA") {
    const cobertura = empenhos.reduce((s, e) => s + e.saldo + (e.valor ?? valorFaturado), 0);
    insuficiente = empenhoInsuficiente(cobertura, valorFaturado);
  }
  const datas: Record<string, string | null> = {};
  const responsaveis: Record<string, string | null> = {};
  const arquivos: Record<string, string | null> = {};
  for (const e of ETAPAS) {
    const d = (c as unknown as Record<string, Date | null>)[e.campoData];
    datas[e.key] = d ? d.toISOString() : null;
    responsaveis[e.key] = (c as unknown as Record<string, string | null>)[e.campoResp] ?? null;
    arquivos[e.key] = (c as unknown as Record<string, string | null>)[e.campoArquivo] ?? null;
  }
  return {
    id: c.id,
    contratoId: c.contratoId,
    vigenciaId: c.vigenciaId,
    contratoNumero: c.contrato.numero,
    orgaoNome: c.contrato.orgaoNome,
    tipo: c.tipo,
    competencia: c.competencia,
    periodoInicio: c.periodoInicio.toISOString(),
    periodoFim: c.periodoFim.toISOString(),
    diasPeriodo: c.diasPeriodo,
    diasBase: c.diasBase,
    status: c.status,
    valorMensalBase: c.valorMensalBase,
    valorPrevisto: c.valorPrevisto,
    valorGlosas: c.valorGlosas,
    ajustes: c.ajustes,
    ajustesJustificativa: c.ajustesJustificativa,
    valorFaturado,
    faturadoFixado,
    retencoes,
    valorRetencoes: c.valorRetencoes,
    valorLiquidoEsperado: liquido,
    valorRecebido: c.valorRecebido,
    numeroNf: c.numeroNf,
    prazoPagamento: prazo ? prazo.toISOString() : null,
    atrasoDias: atraso,
    pagaComAtraso: c.status === "PAGA" && atraso > 0,
    datas,
    responsaveis,
    arquivos,
    empenhos,
    empenhoInsuficiente: insuficiente,
    complementarRef: c.complementarRef,
    complementarDetalhe: c.complementarDetalhe,
    criadaAutomaticamente: c.criadaAutomaticamente,
    observacoes: c.observacoes,
    glosas: c.glosas.map((g) => ({
      id: g.id,
      data: g.data.toISOString(),
      tipo: g.tipo,
      status: g.status,
      valor: g.valor,
      motivo: g.motivo,
      arquivoUrl: g.arquivoUrl,
      contratoItemId: g.contratoItemId,
      itemDescricao: g.contratoItem?.descricao ?? null,
      competenciaOrigemRef: g.competenciaOrigemRef,
      contestacao: g.contestacao,
      contestadaEm: g.contestadaEm ? g.contestadaEm.toISOString() : null,
      decididaEm: g.decididaEm ? g.decididaEm.toISOString() : null,
      complementarId: g.complementarId,
    })),
    imrPontuacoes: Array.isArray(c.imrPontuacoes) ? (c.imrPontuacoes as ResumoCompetencia["imrPontuacoes"]) : [],
    garantiaVerbas: c.contrato.garantiaVerbas,
    retencaoCv: { estimada: c.retencaoCvEstimada, informada: c.retencaoCvInformada, detalhe: c.retencaoCvDetalhe },
    docs: (() => {
      const s = situacaoChecklist(c.itensChecklist);
      return { itens: c.itensChecklist.length, obrigatorios: s.obrigatorios, pendentes: s.pendentes, completo: s.completo, devolvido: s.devolvido };
    })(),
  };
}

export async function listarCompetenciasDoContrato(contratoId: string, hoje = new Date()): Promise<ResumoCompetencia[]> {
  const [rows, empenhos] = await Promise.all([buscarCompetencias({ contratoId }), empenhosDoContratoComSaldo(contratoId)]);
  const saldos = new Map(empenhos.map((e) => [e.id, e]));
  return rows.map((c) => montarResumo(c, saldos, hoje));
}

export async function listarCompetenciasDaConta(filtro: { contaId: string; id?: string }, hoje = new Date()): Promise<ResumoCompetencia[]> {
  const rows = await buscarCompetencias({ contrato: { empresa: filtro } });
  const contratoIds = [...new Set(rows.map((r) => r.contratoId))];
  const saldos = new Map<string, EmpenhoResumo>();
  for (const id of contratoIds) for (const e of await empenhosDoContratoComSaldo(id)) saldos.set(e.id, e);
  return rows.map((c) => montarResumo(c, saldos, hoje));
}

export async function buscarCompetencia(id: string, contaId: string, hoje = new Date()): Promise<ResumoCompetencia | null> {
  const rows = await buscarCompetencias({ id, contrato: { empresa: { contaId } } });
  if (rows.length === 0) return null;
  const empenhos = await empenhosDoContratoComSaldo(rows[0].contratoId);
  return montarResumo(rows[0], new Map(empenhos.map((e) => [e.id, e])), hoje);
}

/** RN11: executado da vigência = faturado das competências com NF emitida. */
export async function executadoPorVigencia(contratoId: string): Promise<Map<string, number>> {
  const rows = await prisma.competencia.findMany({
    where: { contratoId, status: { in: ["NF_EMITIDA", "NF_ENCAMINHADA", "ATESTADA", "PAGA"] } },
    select: { vigenciaId: true, valorFaturado: true, valorPrevisto: true, valorGlosas: true, ajustes: true },
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = r.vigenciaId ?? "";
    const v = r.valorFaturado ?? calcularFaturado(r.valorPrevisto, r.valorGlosas, r.ajustes);
    out.set(k, Math.round(((out.get(k) ?? 0) + v) * 100) / 100);
  }
  return out;
}

export { indiceStatus };
