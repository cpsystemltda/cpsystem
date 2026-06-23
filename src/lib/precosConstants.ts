import type { Plano } from "@/lib/gateway";

/**
 * Catálogo de preços do CP System (neutro — client + server podem importar).
 *
 * Política (Regina 23/06):
 * - BÁSICO: R$ 397/mês + R$ 39,90 por CNPJ adicional (1 incluso).
 * - PREMIUM: R$ 997/mês com CNPJs ilimitados (sem adicional).
 *
 * A função async `calcularValorMensal(contaId, plano)` está em `precos.ts`
 * (server-only, usa Prisma). Esta versão sincrona é pra UI quando o número
 * de CNPJs já está em mãos.
 */
export const PRECO_BASE: Record<Plano, number> = {
  BASICO: 397,
  PREMIUM: 997,
};

export const PRECO_CNPJ_ADICIONAL = 39.9;
export const CNPJS_INCLUSOS_BASICO = 1;

export type BreakdownCobranca = {
  plano: Plano;
  valorBase: number;
  numCnpjs: number;
  cnpjsAdicionais: number;
  valorAdicional: number;
  valorTotal: number;
};

export function calcularBreakdown(plano: Plano, numCnpjs: number): BreakdownCobranca {
  const valorBase = PRECO_BASE[plano];
  if (plano === "PREMIUM") {
    return {
      plano,
      valorBase,
      numCnpjs,
      cnpjsAdicionais: 0,
      valorAdicional: 0,
      valorTotal: valorBase,
    };
  }
  const cnpjsAdicionais = Math.max(0, numCnpjs - CNPJS_INCLUSOS_BASICO);
  const valorAdicional = cnpjsAdicionais * PRECO_CNPJ_ADICIONAL;
  return {
    plano,
    valorBase,
    numCnpjs,
    cnpjsAdicionais,
    valorAdicional,
    valorTotal: Number((valorBase + valorAdicional).toFixed(2)),
  };
}
