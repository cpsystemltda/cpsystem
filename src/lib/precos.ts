import "server-only";
import { prisma } from "@/lib/prisma";
import type { Plano } from "@/lib/gateway";

/**
 * Catálogo de preços do CP System.
 *
 * Política (Regina 23/06):
 * - BÁSICO: R$ 397/mês + R$ 39,90 por CNPJ adicional (1 incluso).
 * - PREMIUM: R$ 997/mês com CNPJs ilimitados (sem adicional).
 *
 * Use sempre `calcularValorMensal()` em vez de PRECO_BASE no checkout —
 * assim o cálculo segue o número real de CNPJs cadastrados na conta.
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

/** Calcula o valor mensal final pra uma conta. Premium não tem adicional. */
export async function calcularValorMensal(
  contaId: string,
  plano: Plano,
): Promise<BreakdownCobranca> {
  const numCnpjs = await prisma.empresa.count({ where: { contaId } });
  return calcularBreakdown(plano, numCnpjs);
}

/** Versão sincrona pra UI quando o numero de CNPJs já está em mãos. */
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
