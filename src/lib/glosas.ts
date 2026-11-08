/**
 * Medição, glosas e IMR (ESP-005, Igor 07/11/2026). Funções puras.
 */

export type TipoGlosa = "FALTA_NAO_COBERTA" | "POSTO_DESCOBERTO" | "IMR" | "MATERIAL_NAO_FORNECIDO" | "OUTRO";
export type StatusGlosa = "APLICADA" | "CONTESTADA" | "MANTIDA" | "REVERTIDA";

export const TIPOS_GLOSA: TipoGlosa[] = ["FALTA_NAO_COBERTA", "POSTO_DESCOBERTO", "IMR", "MATERIAL_NAO_FORNECIDO", "OUTRO"];
export const ROTULO_TIPO_GLOSA: Record<TipoGlosa, string> = {
  FALTA_NAO_COBERTA: "Falta não coberta",
  POSTO_DESCOBERTO: "Posto descoberto",
  IMR: "IMR (nível de serviço)",
  MATERIAL_NAO_FORNECIDO: "Material não fornecido",
  OUTRO: "Outro",
};
export const ROTULO_STATUS_GLOSA: Record<StatusGlosa, string> = {
  APLICADA: "Aplicada",
  CONTESTADA: "Contestada",
  MANTIDA: "Mantida",
  REVERTIDA: "Revertida",
};

/** Glosa que ainda desconta do valor a receber (RN02: revertida não). */
export function glosaAtiva(status: StatusGlosa): boolean {
  return status !== "REVERTIDA";
}

export function somaGlosasAtivas(glosas: { valor: number; status: StatusGlosa }[]): number {
  return Math.round(glosas.filter((g) => glosaAtiva(g.status)).reduce((s, g) => s + g.valor, 0) * 100) / 100;
}

// ─────────────────────────────────────────────
// IMR (RN03)
// ─────────────────────────────────────────────

export type FaixaImr = { de: number; ate: number; percentualPagamento: number };

export function ehFaixaImr(x: unknown): x is FaixaImr {
  return !!x && typeof x === "object" && typeof (x as FaixaImr).de === "number" && typeof (x as FaixaImr).ate === "number" && typeof (x as FaixaImr).percentualPagamento === "number";
}
export function faixasDe(json: unknown): FaixaImr[] {
  return Array.isArray(json) ? json.filter(ehFaixaImr) : [];
}

/** Percentual do valor a pagar para uma pontuação; null quando nenhuma faixa cobre. */
export function percentualPagamentoImr(faixas: FaixaImr[], pontuacao: number): number | null {
  const f = faixas.find((x) => pontuacao >= Math.min(x.de, x.ate) && pontuacao <= Math.max(x.de, x.ate));
  return f ? f.percentualPagamento : null;
}

export type ResultadoImr = {
  /** Soma dos descontos de cada indicador, em % do valor da competência. */
  descontoPct: number;
  detalhes: { indicadorId: string; nome: string; pontuacao: number; percentualPagamento: number | null; descontoPct: number }[];
  semFaixa: string[];
};

/**
 * Ajuste do IMR na competência: cada indicador devolve o % a pagar pela sua
 * faixa; o desconto da competência é a soma dos descontos (100 − %) dos
 * indicadores informados. Aceite: faixa 80–89 = 97% e 85 pontos → −3%.
 */
export function ajusteImr(
  indicadores: { id: string; nome: string; faixas: FaixaImr[] }[],
  pontuacoes: { indicadorId: string; pontuacao: number }[],
): ResultadoImr {
  const detalhes: ResultadoImr["detalhes"] = [];
  const semFaixa: string[] = [];
  for (const p of pontuacoes) {
    const ind = indicadores.find((i) => i.id === p.indicadorId);
    if (!ind) continue;
    const pct = percentualPagamentoImr(ind.faixas, p.pontuacao);
    if (pct == null) semFaixa.push(ind.nome);
    const desconto = pct == null ? 0 : Math.round((100 - pct) * 100) / 100;
    detalhes.push({ indicadorId: ind.id, nome: ind.nome, pontuacao: p.pontuacao, percentualPagamento: pct, descontoPct: desconto });
  }
  const descontoPct = Math.round(detalhes.reduce((s, d) => s + d.descontoPct, 0) * 100) / 100;
  return { descontoPct: Math.min(100, descontoPct), detalhes, semFaixa };
}

export function valorGlosaImr(valorPrevisto: number, descontoPct: number): number {
  return Math.round(valorPrevisto * (descontoPct / 100) * 100) / 100;
}

/** RN05: total glosado e % sobre o faturado. */
export function indicadorGlosas(competencias: { valorFaturado: number; valorGlosas: number; faturada: boolean }[]): { glosado: number; faturado: number; percentual: number } {
  const glosado = Math.round(competencias.reduce((s, c) => s + (c.valorGlosas || 0), 0) * 100) / 100;
  const faturado = Math.round(competencias.filter((c) => c.faturada).reduce((s, c) => s + c.valorFaturado, 0) * 100) / 100;
  const base = faturado + glosado;
  return { glosado, faturado, percentual: base > 0 ? Math.round((glosado / base) * 10000) / 100 : 0 };
}
