/**
 * Conta vinculada e pagamento pelo fato gerador (ESP-006, Igor 07/11/2026).
 * Funções puras. Percentuais do Anexo XII da IN SEGES/MP 5/2017 (decisão do
 * Igor em 07/11/2026): ficam numa tabela-padrão editável no admin; o
 * contrato pode ter percentuais próprios.
 */

export type GarantiaVerbas = "CONTA_VINCULADA" | "FATO_GERADOR" | "NENHUMA" | "OUTRA";
export const GARANTIAS_VERBAS: GarantiaVerbas[] = ["CONTA_VINCULADA", "FATO_GERADOR", "NENHUMA", "OUTRA"];
export const ROTULO_GARANTIA_VERBAS: Record<GarantiaVerbas, string> = {
  CONTA_VINCULADA: "Conta-depósito vinculada",
  FATO_GERADOR: "Pagamento pelo fato gerador",
  NENHUMA: "Nenhuma",
  OUTRA: "Outra",
};

export type Rat = 1 | 2 | 3;
export type PercentuaisContaVinculada = {
  decimoTerceiro: number;
  feriasTerco: number;
  multaFgts: number;
  incidencia22: Record<"1" | "2" | "3", number>;
};

/** Anexo XII da IN SEGES/MP 5/2017. Totais: 32,82% (RAT 1), 33,03% (RAT 2), 33,25% (RAT 3). */
export const PERCENTUAIS_ANEXO_XII: PercentuaisContaVinculada = {
  decimoTerceiro: 8.33,
  feriasTerco: 12.1,
  multaFgts: 5.0,
  incidencia22: { "1": 7.39, "2": 7.6, "3": 7.82 },
};
export const CHAVE_PARAMETRO_PERCENTUAIS = "contaVinculada.percentuais";

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Lê percentuais de um JSON (admin ou contrato), completando com a tabela-padrão. */
export function percentuaisDe(json: unknown, base: PercentuaisContaVinculada = PERCENTUAIS_ANEXO_XII): PercentuaisContaVinculada {
  if (!json || typeof json !== "object") return base;
  const j = json as Partial<PercentuaisContaVinculada> & { incidencia22?: Partial<Record<"1" | "2" | "3", unknown>> };
  return {
    decimoTerceiro: num(j.decimoTerceiro, base.decimoTerceiro),
    feriasTerco: num(j.feriasTerco, base.feriasTerco),
    multaFgts: num(j.multaFgts, base.multaFgts),
    incidencia22: {
      "1": num(j.incidencia22?.["1"], base.incidencia22["1"]),
      "2": num(j.incidencia22?.["2"], base.incidencia22["2"]),
      "3": num(j.incidencia22?.["3"], base.incidencia22["3"]),
    },
  };
}

export type CodigoRubrica = "DECIMO_TERCEIRO" | "FERIAS_TERCO" | "MULTA_FGTS" | "INCIDENCIA_22";
export const ROTULO_RUBRICA: Record<CodigoRubrica, string> = {
  DECIMO_TERCEIRO: "13º salário",
  FERIAS_TERCO: "Férias e 1/3 constitucional",
  MULTA_FGTS: "Multa do FGTS e contribuição social (aviso prévio)",
  INCIDENCIA_22: "Incidência do submódulo 2.2 sobre férias, 1/3 e 13º",
};

export function rubricasDe(p: PercentuaisContaVinculada, rat: Rat): { codigo: CodigoRubrica; rotulo: string; pct: number }[] {
  return [
    { codigo: "DECIMO_TERCEIRO", rotulo: ROTULO_RUBRICA.DECIMO_TERCEIRO, pct: p.decimoTerceiro },
    { codigo: "FERIAS_TERCO", rotulo: ROTULO_RUBRICA.FERIAS_TERCO, pct: p.feriasTerco },
    { codigo: "MULTA_FGTS", rotulo: ROTULO_RUBRICA.MULTA_FGTS, pct: p.multaFgts },
    { codigo: "INCIDENCIA_22", rotulo: `${ROTULO_RUBRICA.INCIDENCIA_22} (RAT ${rat}%)`, pct: p.incidencia22[String(rat) as "1" | "2" | "3"] },
  ];
}
export function totalPct(p: PercentuaisContaVinculada, rat: Rat): number {
  return Math.round(rubricasDe(p, rat).reduce((s, r) => s + r.pct, 0) * 100) / 100;
}
export function ratDe(v: unknown): Rat {
  return v === 2 || v === 3 ? v : 1;
}

export type FuncaoParaRetencao = {
  itemId: string;
  funcao: string;
  salarioBase: number | null; // da planilha de custos vigente (ESP-003, dados derivados)
  colaboradores: number; // posto × colaboradores por posto
};

export type DetalheRetencao = {
  itemId: string;
  funcao: string;
  salarioBase: number | null;
  colaboradores: number;
  base: number; // salário × colaboradores × fator
  rubricas: { codigo: CodigoRubrica; rotulo: string; pct: number; valor: number }[];
  total: number;
};

/**
 * RN03: retenção mensal estimada = Σ por função (salário-base × colaboradores
 * × percentuais). `fator` é o pro rata da competência (dias/base).
 */
export function retencaoEstimada(
  funcoes: FuncaoParaRetencao[],
  p: PercentuaisContaVinculada,
  rat: Rat,
  fator = 1,
): { total: number; detalhe: DetalheRetencao[]; semPlanilha: string[]; porRubrica: { codigo: CodigoRubrica; rotulo: string; pct: number; valor: number }[] } {
  const rubs = rubricasDe(p, rat);
  const detalhe: DetalheRetencao[] = [];
  const semPlanilha: string[] = [];
  const acumulado = new Map<CodigoRubrica, number>();
  for (const f of funcoes) {
    if (f.salarioBase == null || f.salarioBase <= 0) {
      semPlanilha.push(f.funcao);
      continue;
    }
    const base = Math.round(f.salarioBase * f.colaboradores * fator * 100) / 100;
    const rubricas = rubs.map((r) => {
      const valor = Math.round(base * (r.pct / 100) * 100) / 100;
      acumulado.set(r.codigo, (acumulado.get(r.codigo) ?? 0) + valor);
      return { ...r, valor };
    });
    detalhe.push({ itemId: f.itemId, funcao: f.funcao, salarioBase: f.salarioBase, colaboradores: f.colaboradores, base, rubricas, total: Math.round(rubricas.reduce((s, r) => s + r.valor, 0) * 100) / 100 });
  }
  const porRubrica = rubs.map((r) => ({ ...r, valor: Math.round((acumulado.get(r.codigo) ?? 0) * 100) / 100 }));
  return { total: Math.round(detalhe.reduce((s, d) => s + d.total, 0) * 100) / 100, detalhe, semPlanilha, porRubrica };
}

// ─────────────────────────────────────────────
// Saldo (RN04 / RN07)
// ─────────────────────────────────────────────

export type RetencaoDeCompetencia = { competencia: string; status: string; estimada: number | null; informada: number | null };

/** Valor que conta para o saldo: o informado pelo comprovante, senão o estimado; só de competência PAGA. */
export function retencaoEfetiva(r: RetencaoDeCompetencia): number {
  return Math.round((r.informada ?? r.estimada ?? 0) * 100) / 100;
}

export function saldoContaVinculada(opts: {
  retencoes: RetencaoDeCompetencia[];
  liberacoes: { status: string; valorLiberado: number | null }[];
  rendimentos: number;
}): { retido: number; aReter: number; liberado: number; rendimentos: number; saldo: number } {
  const pagas = opts.retencoes.filter((r) => r.status === "PAGA");
  const faturadasNaoPagas = opts.retencoes.filter((r) => ["NF_EMITIDA", "NF_ENCAMINHADA", "ATESTADA"].includes(r.status));
  const retido = Math.round(pagas.reduce((s, r) => s + retencaoEfetiva(r), 0) * 100) / 100;
  const aReter = Math.round(faturadasNaoPagas.reduce((s, r) => s + retencaoEfetiva(r), 0) * 100) / 100;
  const liberado = Math.round(opts.liberacoes.filter((l) => l.status === "DEFERIDO" || l.status === "DEFERIDO_PARCIAL").reduce((s, l) => s + (l.valorLiberado ?? 0), 0) * 100) / 100;
  const rendimentos = Math.round((opts.rendimentos || 0) * 100) / 100;
  return { retido, aReter, liberado, rendimentos, saldo: Math.round((retido - liberado + rendimentos) * 100) / 100 };
}

// ─────────────────────────────────────────────
// Pedidos de liberação (RN05) e alertas (RN06)
// ─────────────────────────────────────────────

export type FatoGerador = "FERIAS" | "DECIMO_TERCEIRO" | "RESCISAO" | "OUTRO";
export const FATOS_GERADORES: FatoGerador[] = ["FERIAS", "DECIMO_TERCEIRO", "RESCISAO", "OUTRO"];
export const ROTULO_FATO_GERADOR: Record<FatoGerador, string> = { FERIAS: "Férias", DECIMO_TERCEIRO: "13º salário", RESCISAO: "Rescisão", OUTRO: "Outro" };

export type StatusPedido = "RASCUNHO" | "PROTOCOLADO" | "EM_ANALISE" | "DEFERIDO_PARCIAL" | "DEFERIDO" | "INDEFERIDO";
export const STATUS_PEDIDO: StatusPedido[] = ["RASCUNHO", "PROTOCOLADO", "EM_ANALISE", "DEFERIDO_PARCIAL", "DEFERIDO", "INDEFERIDO"];
export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  RASCUNHO: "Rascunho",
  PROTOCOLADO: "Protocolado",
  EM_ANALISE: "Em análise",
  DEFERIDO_PARCIAL: "Deferido parcialmente",
  DEFERIDO: "Deferido",
  INDEFERIDO: "Indeferido",
};
export function pedidoAberto(status: string): boolean {
  return status === "PROTOCOLADO" || status === "EM_ANALISE";
}

const DIA_MS = 86_400_000;
export type AlertaContaVinculada = { tipo: "PEDIDO_PARADO" | "DECIMO_SEM_PEDIDO" | "FIM_VIGENCIA_COM_SALDO"; texto: string; grave: boolean };

export function alertasContaVinculada(opts: {
  hoje: Date;
  prazoDias?: number | null;
  pedidos: { fatoGerador: string; status: string; dataPedido: Date; competenciaRef: string | null; valorSolicitado: number }[];
  retidoNoAno: number;
  vigenciaFim: Date;
  saldo: number;
  fatoGerador: boolean; // regime "pagamento pelo fato gerador"
}): AlertaContaVinculada[] {
  const out: AlertaContaVinculada[] = [];
  const prazo = opts.prazoDias ?? 30;
  for (const p of opts.pedidos) {
    if (!pedidoAberto(p.status)) continue;
    const dias = Math.floor((opts.hoje.getTime() - p.dataPedido.getTime()) / DIA_MS);
    if (dias > prazo) {
      out.push({ tipo: "PEDIDO_PARADO", grave: true, texto: `Pedido de liberação (${ROTULO_FATO_GERADOR[p.fatoGerador as FatoGerador] ?? p.fatoGerador}, ${moedaBr(p.valorSolicitado)}) protocolado há ${dias} dias sem resposta — prazo de ${prazo} dias.` });
    }
  }
  // 13º: de 1º/11 a 30/11, retenção acumulada no ano e nenhum pedido de 13º neste ano.
  const ano = opts.hoje.getUTCFullYear();
  const mes = opts.hoje.getUTCMonth() + 1;
  if (mes === 11 && opts.retidoNoAno > 0) {
    const temPedido13 = opts.pedidos.some((p) => p.fatoGerador === "DECIMO_TERCEIRO" && p.status !== "INDEFERIDO" && (p.competenciaRef?.startsWith(String(ano)) || p.dataPedido.getUTCFullYear() === ano));
    if (!temPedido13) out.push({ tipo: "DECIMO_SEM_PEDIDO", grave: false, texto: `Há ${opts.retidoNoAno.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ${opts.fatoGerador ? "provisionados" : "retidos"} em ${ano} e nenhum pedido de liberação do 13º até agora — o prazo de referência é 30/11.` });
  }
  const diasParaFim = Math.ceil((opts.vigenciaFim.getTime() - opts.hoje.getTime()) / DIA_MS);
  if (diasParaFim <= 60 && opts.saldo > 0) {
    out.push({ tipo: "FIM_VIGENCIA_COM_SALDO", grave: diasParaFim <= 0, texto: diasParaFim <= 0 ? `Vigência encerrada com ${opts.fatoGerador ? "valores provisionados não pagos" : "saldo na conta vinculada"} de ${moedaBr(opts.saldo)}: situação "a resgatar".` : `Vigência termina em ${diasParaFim} dias e ainda há ${moedaBr(opts.saldo)} ${opts.fatoGerador ? "provisionados não pagos" : "na conta vinculada"}.` });
  }
  return out;
}


function moedaBr(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
