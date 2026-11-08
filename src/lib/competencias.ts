/**
 * Competências mensais de contrato de mão de obra (ESP-004, Igor 07/11/2026).
 * Funções puras — valem no servidor e no cliente. Datas em UTC "de dia"
 * (o projeto grava datas de calendário como meio-dia UTC; aqui tudo é
 * normalizado para 00:00 UTC antes de contar dias).
 */

export type CicloCompetencia = "MES_CIVIL" | "ANIVERSARIO";
export type CriterioProRata = "DIAS_CORRIDOS" | "MES_COMERCIAL";

export type Periodo = {
  /** Rótulo "YYYY-MM" da competência. */
  competencia: string;
  inicio: Date; // 00:00 UTC
  fim: Date; // 00:00 UTC, inclusivo
  diasPeriodo: number;
  /** Dias do ciclo cheio em que o período cai (base do pro rata). */
  diasBase: number;
  /** O período cobre o ciclo inteiro (sem pro rata). */
  cheio: boolean;
};

const DIA_MS = 86_400_000;

export function diaUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDias(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DIA_MS);
}
function diasEntreInclusivo(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DIA_MS) + 1;
}
function ultimoDiaDoMes(ano: number, mes0: number): number {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
}
function dataSegura(ano: number, mes0: number, dia: number): Date {
  const r = new Date(Date.UTC(ano, mes0, 1));
  return new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), Math.min(dia, ultimoDiaDoMes(r.getUTCFullYear(), r.getUTCMonth()))));
}
export function competenciaDe(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function rotuloCompetencia(c: string): string {
  const [a, m] = c.split("-").map(Number);
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${nomes[(m || 1) - 1]}/${a}`;
}
export function rotuloCompetenciaCurto(c: string): string {
  const [a, m] = c.split("-").map(Number);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[(m || 1) - 1]}/${String(a).slice(2)}`;
}

/**
 * Caso de borda da ESP-004: vigência de 09/05 a 09/05 — o último dia é o
 * anterior ao início da seguinte, para não faturar o mesmo dia duas vezes
 * (mesma leitura de `mesesDaVigencia`). Fim em outro dia é inclusivo.
 */
export function fimEfetivoDaVigencia(inicio: Date, fim: Date): Date {
  const i = diaUtc(inicio);
  const f = diaUtc(fim);
  if (f.getUTCDate() === i.getUTCDate() && f > i) return addDias(f, -1);
  return f;
}

/**
 * Períodos (competências) de uma vigência.
 *
 * - MES_CIVIL (padrão): do início ao último dia do mês, depois meses
 *   inteiros, até o fim efetivo. Rótulo = mês do período.
 * - MES_CIVIL com `diaFechamento` (1..28): ciclo fecha nesse dia (26/04 a
 *   25/05); rótulo = mês em que fecha.
 * - ANIVERSARIO: do dia do início de cada mês ao dia anterior no mês
 *   seguinte (09/05 a 08/06); rótulo = mês do início do período.
 */
export function periodosDaVigencia(opts: {
  inicio: Date;
  fim: Date;
  ciclo?: CicloCompetencia | null;
  diaFechamento?: number | null;
}): Periodo[] {
  const ini = diaUtc(opts.inicio);
  const fimEf = fimEfetivoDaVigencia(opts.inicio, opts.fim);
  if (fimEf < ini) return [];
  const ciclo: CicloCompetencia = opts.ciclo ?? "MES_CIVIL";
  const out: Periodo[] = [];

  if (ciclo === "MES_CIVIL" && !opts.diaFechamento) {
    let cursor = ini;
    for (let guarda = 0; guarda < 600 && cursor <= fimEf; guarda++) {
      const ano = cursor.getUTCFullYear();
      const mes0 = cursor.getUTCMonth();
      const primeiro = new Date(Date.UTC(ano, mes0, 1));
      const ultimo = new Date(Date.UTC(ano, mes0, ultimoDiaDoMes(ano, mes0)));
      const fim = ultimo < fimEf ? ultimo : fimEf;
      const diasBase = ultimoDiaDoMes(ano, mes0);
      out.push({
        competencia: competenciaDe(cursor),
        inicio: cursor,
        fim,
        diasPeriodo: diasEntreInclusivo(cursor, fim),
        diasBase,
        cheio: cursor.getTime() === primeiro.getTime() && fim.getTime() === ultimo.getTime(),
      });
      cursor = addDias(ultimo, 1);
    }
    return out;
  }

  // Ciclos ancorados num dia: aniversário (dia do início) ou dia de fechamento.
  const ancoraInicio = ciclo === "ANIVERSARIO" ? ini.getUTCDate() : (opts.diaFechamento as number) + 1;
  // Início do ciclo que contém `ini`.
  let cicloIni: Date;
  if (ciclo === "ANIVERSARIO") cicloIni = ini;
  else {
    const candidato = dataSegura(ini.getUTCFullYear(), ini.getUTCMonth(), ancoraInicio);
    cicloIni = candidato <= ini ? candidato : dataSegura(ini.getUTCFullYear(), ini.getUTCMonth() - 1, ancoraInicio);
  }
  let cursor = ini;
  for (let guarda = 0; guarda < 600 && cursor <= fimEf; guarda++) {
    const proxCicloIni = dataSegura(cicloIni.getUTCFullYear(), cicloIni.getUTCMonth() + 1, ancoraInicio);
    const cicloFim = addDias(proxCicloIni, -1);
    const fim = cicloFim < fimEf ? cicloFim : fimEf;
    const diasBase = diasEntreInclusivo(cicloIni, cicloFim);
    const rotuloData = ciclo === "ANIVERSARIO" ? cicloIni : cicloFim;
    out.push({
      competencia: competenciaDe(rotuloData),
      inicio: cursor,
      fim,
      diasPeriodo: diasEntreInclusivo(cursor, fim),
      diasBase,
      cheio: cursor.getTime() === cicloIni.getTime() && fim.getTime() === cicloFim.getTime(),
    });
    cicloIni = proxCicloIni;
    cursor = proxCicloIni;
  }
  return out;
}

/** RN03: valor previsto de um período, pro rata por dias corridos ou mês comercial. */
export function valorPrevistoDoPeriodo(p: Periodo, valorMensal: number, criterio?: CriterioProRata | null): number {
  if (p.cheio) return Math.round(valorMensal * 100) / 100;
  const base = (criterio ?? "DIAS_CORRIDOS") === "MES_COMERCIAL" ? 30 : p.diasBase;
  const fator = Math.min(1, p.diasPeriodo / base);
  return Math.round(valorMensal * fator * 100) / 100;
}

/** Versão de valor mensal válida num intervalo (ESP-002 RN07). `ate` null = aberto. */
export type VersaoValorMensal = { de: Date; ate: Date | null; valorMensal: number };

/**
 * Valor previsto quando o valor mensal muda dentro do período (aditivo de
 * postos com efeito no meio do mês): cada trecho entra pro rata por dias.
 */
export function valorPrevistoComVersoes(p: Periodo, versoes: VersaoValorMensal[], criterio?: CriterioProRata | null): { valor: number; valorMensalBase: number } {
  if (versoes.length === 0) return { valor: 0, valorMensalBase: 0 };
  const ordenadas = [...versoes].sort((a, b) => a.de.getTime() - b.de.getTime());
  const base = (criterio ?? "DIAS_CORRIDOS") === "MES_COMERCIAL" ? 30 : p.diasBase;
  let total = 0;
  let ultimaVigente = ordenadas[0].valorMensal;
  let diasCobertos = 0;
  for (const v of ordenadas) {
    const de = diaUtc(v.de) > p.inicio ? diaUtc(v.de) : p.inicio;
    const ate = v.ate ? (diaUtc(v.ate) < p.fim ? diaUtc(v.ate) : p.fim) : p.fim;
    if (ate < de) continue;
    const dias = diasEntreInclusivo(de, ate);
    diasCobertos += dias;
    ultimaVigente = v.valorMensal;
    total += v.valorMensal * Math.min(1, dias / base);
  }
  // Período cheio e uma versão só: valor mensal exato, sem erro de arredondamento.
  if (p.cheio && ordenadas.length === 1) return { valor: Math.round(ordenadas[0].valorMensal * 100) / 100, valorMensalBase: ordenadas[0].valorMensal };
  if (p.cheio && diasCobertos >= p.diasPeriodo && total > ultimaVigente * 1.0001 && base !== p.diasBase) total = Math.min(total, ultimaVigente);
  return { valor: Math.round(total * 100) / 100, valorMensalBase: ultimaVigente };
}

/** Item com janela de vigência (versão). Sem datas = vale a vigência toda. */
export function itemVigenteEm<T extends { vigenteDe?: Date | null; vigenteAte?: Date | null }>(item: T, dia: Date): boolean {
  const d = diaUtc(dia);
  if (item.vigenteDe && diaUtc(item.vigenteDe) > d) return false;
  if (item.vigenteAte && diaUtc(item.vigenteAte) < d) return false;
  return true;
}
export function itensVigentesEm<T extends { vigenteDe?: Date | null; vigenteAte?: Date | null }>(itens: T[], dia: Date): T[] {
  return itens.filter((i) => itemVigenteEm(i, dia));
}

/**
 * Versões de valor mensal de uma vigência a partir das janelas dos itens:
 * uma versão por trecho entre datas de efeito.
 */
export function versoesDeValorMensal<T extends { quantidade: number; valorUnitario: number; vigenteDe?: Date | null; vigenteAte?: Date | null }>(
  itens: T[],
  vigInicio: Date,
  vigFim: Date,
): VersaoValorMensal[] {
  const ini = diaUtc(vigInicio);
  const fim = fimEfetivoDaVigencia(vigInicio, vigFim);
  const marcos = new Set<number>([ini.getTime()]);
  for (const it of itens) {
    if (it.vigenteDe) {
      const d = diaUtc(it.vigenteDe);
      if (d > ini && d <= fim) marcos.add(d.getTime());
    }
    if (it.vigenteAte) {
      const d = addDias(diaUtc(it.vigenteAte), 1);
      if (d > ini && d <= fim) marcos.add(d.getTime());
    }
  }
  const datas = [...marcos].sort((a, b) => a - b).map((t) => new Date(t));
  return datas.map((de, i) => {
    const ate = i + 1 < datas.length ? addDias(datas[i + 1], -1) : null;
    const vigentes = itensVigentesEm(itens, de);
    return { de, ate, valorMensal: Math.round(vigentes.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0) * 100) / 100 };
  });
}

// ─────────────────────────────────────────────
// Etapas (RN04)
// ─────────────────────────────────────────────
export type StatusCompetencia = "A_CONFIRMAR" | "EM_EXECUCAO" | "MEDICAO" | "DOC_TRABALHISTA" | "NF_EMITIDA" | "NF_ENCAMINHADA" | "ATESTADA" | "PAGA";
export type EtapaKey = Exclude<StatusCompetencia, "A_CONFIRMAR" | "EM_EXECUCAO">;

export const ETAPAS: { key: EtapaKey; rotulo: string; curto: string; campoData: string; campoResp: string; campoArquivo: string; ajuda: string }[] = [
  { key: "MEDICAO", rotulo: "Medição e glosas", curto: "Medição", campoData: "dataMedicao", campoResp: "responsavelMedicao", campoArquivo: "arquivoMedicao", ajuda: "Relatório de medição do mês e glosas aplicadas pelo órgão." },
  { key: "DOC_TRABALHISTA", rotulo: "Documentação trabalhista enviada", curto: "Doc. trabalhista", campoData: "dataDocTrabalhista", campoResp: "responsavelDocTrabalhista", campoArquivo: "arquivoDocTrabalhista", ajuda: "Folha, guias e comprovantes do mês entregues ao fiscal." },
  { key: "NF_EMITIDA", rotulo: "NF emitida", curto: "NF emitida", campoData: "dataNfEmitida", campoResp: "responsavelNfEmitida", campoArquivo: "arquivoNfEmitida", ajuda: "Aqui o valor faturado é fixado e as retenções são informadas." },
  { key: "NF_ENCAMINHADA", rotulo: "NF encaminhada", curto: "NF encaminhada", campoData: "dataNfEncaminhada", campoResp: "responsavelNfEncaminhada", campoArquivo: "arquivoNfEncaminhada", ajuda: "Protocolo de entrega da nota ao órgão." },
  { key: "ATESTADA", rotulo: "Atestada", curto: "Atestada", campoData: "dataAteste", campoResp: "responsavelAteste", campoArquivo: "arquivoAteste", ajuda: "Ateste do fiscal: a partir daqui costuma contar o prazo de pagamento." },
  { key: "PAGA", rotulo: "Paga", curto: "Paga", campoData: "dataPagamento", campoResp: "responsavelPagamento", campoArquivo: "arquivoPagamento", ajuda: "Comprovante do pagamento e valor efetivamente recebido." },
];
export const ORDEM_STATUS: StatusCompetencia[] = ["A_CONFIRMAR", "EM_EXECUCAO", "MEDICAO", "DOC_TRABALHISTA", "NF_EMITIDA", "NF_ENCAMINHADA", "ATESTADA", "PAGA"];
export const ROTULO_STATUS: Record<StatusCompetencia, string> = {
  A_CONFIRMAR: "A confirmar",
  EM_EXECUCAO: "Em execução",
  MEDICAO: "Medição registrada",
  DOC_TRABALHISTA: "Doc. trabalhista enviada",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  ATESTADA: "Atestada",
  PAGA: "Paga",
};
export function indiceStatus(s: StatusCompetencia): number {
  return ORDEM_STATUS.indexOf(s);
}
export function faturadaOuAlem(s: StatusCompetencia): boolean {
  return indiceStatus(s) >= indiceStatus("NF_EMITIDA");
}

// ─────────────────────────────────────────────
// Valores (RN05)
// ─────────────────────────────────────────────
export type Retencao = { codigo: string; rotulo: string; pct: number | null; valor: number };

export const RETENCOES_PADRAO: Omit<Retencao, "valor">[] = [
  { codigo: "INSS", rotulo: "INSS (retenção de 11%, Lei 8.212, art. 31)", pct: 11 },
  { codigo: "IR", rotulo: "IR na fonte", pct: 0 },
  { codigo: "CSLL_PIS_COFINS", rotulo: "CSLL / PIS / COFINS", pct: 0 },
  { codigo: "ISS", rotulo: "ISS", pct: 0 },
  { codigo: "CONTA_VINCULADA", rotulo: "Conta vinculada (verbas trabalhistas)", pct: 0 },
];

export function calcularFaturado(previsto: number, glosas: number, ajustes: number): number {
  return Math.round((previsto - (glosas || 0) + (ajustes || 0)) * 100) / 100;
}

/** Aplica percentuais sobre o faturado; valor informado à mão prevalece sobre o percentual. */
export function aplicarRetencoes(faturado: number, retencoes: { codigo: string; rotulo: string; pct: number | null; valor?: number | null }[]): { retencoes: Retencao[]; total: number; liquido: number } {
  const calc: Retencao[] = retencoes.map((r) => {
    const valor = r.valor != null && Number.isFinite(r.valor) ? r.valor : r.pct ? (faturado * r.pct) / 100 : 0;
    return { codigo: r.codigo, rotulo: r.rotulo, pct: r.pct ?? null, valor: Math.round(valor * 100) / 100 };
  });
  const total = Math.round(calc.reduce((s, r) => s + r.valor, 0) * 100) / 100;
  return { retencoes: calc, total, liquido: Math.round((faturado - total) * 100) / 100 };
}

// ─────────────────────────────────────────────
// Prazo de pagamento (RN07)
// ─────────────────────────────────────────────
export type TermoInicialPagamento = "ATESTE_NF" | "RECEBIMENTO_NF" | "OUTRO";

export function prazoDePagamento(opts: {
  termoInicial?: TermoInicialPagamento | null;
  prazoDias?: number | null;
  dataAteste?: Date | null;
  dataNfEncaminhada?: Date | null;
  dataNfEmitida?: Date | null;
}): Date | null {
  const dias = opts.prazoDias ?? 30;
  const termo = opts.termoInicial ?? "ATESTE_NF";
  const marco =
    termo === "RECEBIMENTO_NF"
      ? opts.dataNfEncaminhada ?? null
      : termo === "ATESTE_NF"
        ? opts.dataAteste ?? null
        : opts.dataAteste ?? opts.dataNfEncaminhada ?? null;
  if (!marco) return null;
  return addDias(diaUtc(marco), dias);
}

/** Dias de atraso em relação ao prazo (0 quando dentro do prazo ou sem prazo). */
export function diasDeAtraso(prazo: Date | null | undefined, referencia: Date): number {
  if (!prazo) return 0;
  const d = Math.round((diaUtc(referencia).getTime() - diaUtc(prazo).getTime()) / DIA_MS);
  return d > 0 ? d : 0;
}

/** Saldo de empenho frente à competência (RN06). */
export function empenhoInsuficiente(saldoEmpenho: number, valorPrevisto: number): boolean {
  return saldoEmpenho + 0.005 < valorPrevisto;
}

export function dataIsoDia(d: Date): string {
  return diaUtc(d).toISOString().slice(0, 10);
}
export function dataBrDia(d: Date | string): string {
  const s = typeof d === "string" ? d.slice(0, 10) : dataIsoDia(d);
  return s.split("-").reverse().join("/");
}
