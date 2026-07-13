import type { Plano } from "@/lib/gateway";

/**
 * Catálogo de preços do CP System (neutro — client + server podem importar).
 *
 * Política (Regina 13/07 — proposta Igor com 3 planos):
 * - BÁSICO R$ 397/mês: 1 CNPJ + R$ 39,90 por CNPJ adicional.
 * - INTERMEDIÁRIO R$ 597/mês: 3 CNPJs inclusos + R$ 39,90 por adicional +
 *   conciliação bancária + IA nativa (10 perguntas/mês).
 * - PREMIUM R$ 997/mês: CNPJs ilimitados + IA ilimitada + franquia jurídica.
 *
 * A função async `calcularValorMensal(contaId, plano)` está em `precos.ts`
 * (server-only, usa Prisma). Esta versão sincrona é pra UI quando o número
 * de CNPJs já está em mãos.
 */
export const PRECO_BASE: Record<Plano, number> = {
  BASICO: 397,
  INTERMEDIARIO: 597,
  PREMIUM: 997,
};

export const PRECO_CNPJ_ADICIONAL = 39.9;
export const CNPJS_INCLUSOS: Record<Plano, number | "ilimitado"> = {
  BASICO: 1,
  INTERMEDIARIO: 3,
  PREMIUM: "ilimitado",
};

// Limite mensal de perguntas ao IAsystem por plano (Regina 13/07)
export const LIMITE_IA_MENSAL: Record<Plano, number | "ilimitado"> = {
  BASICO: 0,
  INTERMEDIARIO: 10,
  PREMIUM: "ilimitado",
};

// Compat — mantido pra codigo antigo referenciar
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
  const inclusos = CNPJS_INCLUSOS[plano];
  if (inclusos === "ilimitado") {
    return {
      plano,
      valorBase,
      numCnpjs,
      cnpjsAdicionais: 0,
      valorAdicional: 0,
      valorTotal: valorBase,
    };
  }
  const cnpjsAdicionais = Math.max(0, numCnpjs - inclusos);
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
