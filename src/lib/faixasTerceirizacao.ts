/**
 * Liberação do Módulo Terceirização e cobrança por faixa de colaboradores
 * (ESP-011, Igor 07/11/2026). Funções puras.
 *
 * Faixas iniciais do Anexo B.1 da especificação — AGUARDAM APROVAÇÃO do
 * Igor; ficam editáveis no admin (ParametroPlataforma), não no código.
 */

export type Faixa = { ate: number | null; valor: number }; // ate null = sem teto
export const CHAVE_FAIXAS = "terceirizacao.faixas";
export const CHAVE_NOME_PACOTE = "terceirizacao.nomePacote";
export const NOME_PACOTE_PADRAO = "Premium Terceirização";

export const FAIXAS_ANEXO_B1: Faixa[] = [
  { ate: 25, valor: 0 },
  { ate: 50, valor: 197 },
  { ate: 100, valor: 347 },
  { ate: 200, valor: 597 },
  { ate: 400, valor: 997 },
  { ate: 700, valor: 1497 },
];

export function faixasDe(json: unknown): Faixa[] {
  if (!Array.isArray(json)) return FAIXAS_ANEXO_B1;
  const lista = json
    .filter((f) => f && typeof f === "object" && typeof (f as Faixa).valor === "number" && ((f as Faixa).ate === null || typeof (f as Faixa).ate === "number"))
    .map((f) => ({ ate: (f as Faixa).ate, valor: (f as Faixa).valor }))
    .sort((a, b) => (a.ate ?? Infinity) - (b.ate ?? Infinity));
  return lista.length ? lista : FAIXAS_ANEXO_B1;
}

export type FaixaApurada = { indice: number; de: number; ate: number | null; valor: number; acimaDaUltima: boolean };

/** Faixa que contém n colaboradores. Acima da última com teto: fica na última e marca "acima" (negociação). */
export function faixaDe(n: number, faixas: Faixa[]): FaixaApurada {
  let de = 1;
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i];
    if (f.ate === null || n <= f.ate) return { indice: i, de, ate: f.ate, valor: f.valor, acimaDaUltima: false };
    de = f.ate + 1;
  }
  const ult = faixas[faixas.length - 1];
  const deUlt = faixas.length > 1 ? (faixas[faixas.length - 2].ate ?? 0) + 1 : 1;
  return { indice: faixas.length - 1, de: deUlt, ate: ult.ate, valor: ult.valor, acimaDaUltima: true };
}

export function rotuloFaixa(f: { de: number; ate: number | null; acimaDaUltima?: boolean }): string {
  if (f.acimaDaUltima) return `acima de ${f.ate}`;
  return f.ate === null ? `${f.de} ou mais` : `${f.de} a ${f.ate}`;
}

/** RN04: aviso quando atinge 90% do limite da faixa (só faixas com teto). */
export function atingiu90(n: number, f: FaixaApurada): boolean {
  return f.ate !== null && !f.acimaDaUltima && n >= Math.ceil(f.ate * 0.9) && n <= f.ate;
}

/**
 * RN01/RN06/RN07: o que a conta pode fazer no módulo.
 * - LIBERADO: Premium (ativa ou inadimplente — inadimplência tem fluxo próprio)
 *   ou trial vigente;
 * - SOMENTE_LEITURA: perdeu o plano há até 90 dias e tem dados;
 * - BLOQUEADO: demais (vê convite de upgrade). O cadastro básico do contrato
 *   de mão de obra continua em todos os planos.
 */
export type AcessoModulo = "LIBERADO" | "SOMENTE_LEITURA" | "BLOQUEADO";

export function acessoModulo(c: { plano: string; statusAssinatura: string; trialAteEm: Date | null; terceirizacaoPerdidaEm?: Date | null }, hoje = new Date()): AcessoModulo {
  if (c.statusAssinatura === "TRIAL") return !c.trialAteEm || c.trialAteEm >= hoje ? "LIBERADO" : leituraOuBloqueio(c.terceirizacaoPerdidaEm, hoje);
  if (c.plano === "PREMIUM" && c.statusAssinatura !== "CANCELADA") return "LIBERADO";
  return leituraOuBloqueio(c.terceirizacaoPerdidaEm, hoje);
}

function leituraOuBloqueio(perdidaEm: Date | null | undefined, hoje: Date): AcessoModulo {
  if (perdidaEm && hoje.getTime() - perdidaEm.getTime() <= 90 * 86_400_000) return "SOMENTE_LEITURA";
  return "BLOQUEADO";
}

/** RN06: último dia (ou últimos) do trial — mostra a faixa estimada. */
export function diasRestantesTrial(trialAteEm: Date | null, hoje = new Date()): number | null {
  if (!trialAteEm) return null;
  return Math.ceil((trialAteEm.getTime() - hoje.getTime()) / 86_400_000);
}
