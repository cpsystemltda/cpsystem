/**
 * Contratos de mão de obra — postos e valor mensal (ESP-002, Igor 07/11/2026).
 *
 * Num contrato de dedicação exclusiva o item é um posto (ou um empregado)
 * com valor MENSAL. O contrato da Sonne (005/2023, 7 funções, 170 postos)
 * somava R$ 612.339,63 nos itens, e o sistema mostrava isso como "valor
 * total contratado" da vigência — o valor real da vigência é mensal × 12 =
 * R$ 7.348.075,56. Estas funções são puras: valem no servidor e no cliente.
 */

export const JORNADAS = [
  "44h semanais",
  "40h semanais",
  "30h semanais",
  "12x36 diurno",
  "12x36 noturno",
  "24x72",
  "Outra",
] as const;

/** Posto 12x36 (ou 24x72) exige dois colaboradores para cobrir a escala. */
export function sugerirColaboradoresPorPosto(jornada: string | null | undefined): number {
  return /12\s*x\s*36|24\s*x\s*72/i.test(jornada ?? "") ? 2 : 1;
}

export function ehValorMensal(c: { tipo: string; valoresMensaisConfirmadosEm: Date | null }): boolean {
  return (
    (c.tipo === "SERVICOS_DEDICACAO_EXCLUSIVA" || c.tipo === "SERVICOS_PREDOMINANCIA_MAO_DE_OBRA") &&
    !!c.valoresMensaisConfirmadosEm
  );
}

function diaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function somarMesesUtc(d: Date, n: number): Date {
  const dia = d.getUTCDate();
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const ultimo = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(dia, ultimo));
  return r;
}

/**
 * Meses de uma vigência, com fração quando ela não fecha meses inteiros
 * (RN03; mesma régua do pro rata por dias corridos da ESP-004).
 *
 * Fim no mesmo dia do mês do início (09/05/2026 → 09/05/2027) é lido como
 * exclusivo — é o aniversário, 12 meses exatos, e o dia 09/05/2027 pertence
 * à vigência seguinte (caso de borda da ESP-004). Fim em outro dia é
 * inclusivo (01/01 → 31/12 = 12 meses).
 */
export function mesesDaVigencia(inicio: Date, fim: Date): number {
  const ini = diaUtc(inicio);
  let fimEx = diaUtc(fim);
  if (fimEx <= ini) return 0;
  if (fim.getUTCDate() !== inicio.getUTCDate()) fimEx = new Date(fimEx.getTime() + 86_400_000);
  let meses = 0;
  let cursor = ini;
  for (let guarda = 0; guarda < 600; guarda++) {
    const prox = somarMesesUtc(cursor, 1);
    if (prox > fimEx) break;
    meses++;
    cursor = prox;
  }
  const restoDias = Math.round((fimEx.getTime() - cursor.getTime()) / 86_400_000);
  const diasNoMes = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  // Início em 29-31 e mês mais curto: o aniversário "cai" no último dia do
  // mês (31/01 → 28/02). O dia seguinte já é o próximo mês; não é fração.
  const aniversarioEncurtado = cursor.getUTCDate() === diasNoMes && ini.getUTCDate() > diasNoMes;
  if (restoDias > 0 && !(aniversarioEncurtado && restoDias === 1)) {
    meses += restoDias / diasNoMes;
  }
  return Math.round(meses * 10_000) / 10_000;
}

export function valorMensalDosItens(itens: { quantidade: number; valorUnitario: number }[]): number {
  return itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
}

export function valorDaVigencia(valorMensal: number, inicio: Date, fim: Date): number {
  return Math.round(valorMensal * mesesDaVigencia(inicio, fim) * 100) / 100;
}

/** RN02: total de colaboradores que o item exige (posto × colaboradores por posto). */
export function colaboradoresNecessarios(item: {
  quantidade: number;
  unidadeMaoDeObra?: string | null;
  colaboradoresPorPosto?: number | null;
}): number {
  const porPosto = item.unidadeMaoDeObra === "POSTO" ? Math.max(1, item.colaboradoresPorPosto ?? 1) : 1;
  return Math.round(item.quantidade * porPosto);
}

type ContratoParaValor = {
  tipo: string;
  valoresMensaisConfirmadosEm: Date | null;
  vigenciaInicio: Date;
  vigenciaFim: Date;
  itens: { valorTotal: number; vigenciaId?: string | null }[];
  vigencias?: { id: string; ordem: number; dataInicio: Date; dataFim: Date }[];
};

/**
 * Valor do contrato para lista, dashboard e relatórios (RN08).
 *
 * Contrato comum: soma dos itens, como sempre foi. Contrato de mão de obra
 * com valores confirmados como mensais: valor mensal da vigência atual ×
 * meses dela. Vigência atual = a que contém hoje; senão, a última.
 */
export function valorExibidoDoContrato(c: ContratoParaValor, hoje: Date = new Date()): number {
  const somaTudo = c.itens.reduce((s, i) => s + i.valorTotal, 0);
  if (!ehValorMensal(c)) return somaTudo;
  const vigs = c.vigencias ?? [];
  const atual =
    vigs.find((v) => v.dataInicio <= hoje && v.dataFim >= hoje) ??
    (vigs.length ? vigs.reduce((a, b) => (b.ordem > a.ordem ? b : a)) : null);
  if (!atual) return valorDaVigencia(somaTudo, c.vigenciaInicio, c.vigenciaFim);
  const daVig = c.itens.filter((i) => i.vigenciaId === atual.id);
  const mensal = daVig.length ? daVig.reduce((s, i) => s + i.valorTotal, 0) : somaTudo;
  return valorDaVigencia(mensal, atual.dataInicio, atual.dataFim);
}
