import type { Plano } from "@/lib/gateway";

/**
 * Catálogo de preços do CP System (neutro — client + server podem importar).
 *
 * Política (Regina 13/07 — proposta Igor com 3 planos):
 * - BÁSICO R$ 397/mês: 1 CNPJ + R$ 39,90 por CNPJ adicional.
 * - INTERMEDIÁRIO R$ 697/mês: 3 CNPJs inclusos + R$ 39,90 por adicional +
 *   conciliação bancária + IA nativa (10 perguntas/mês).
 * - PREMIUM R$ 997/mês: CNPJs ilimitados + IA ilimitada + franquia jurídica.
 *
 * Colaboradores (Regina 21/08): 2 inclusos em qualquer plano; do 3º em diante,
 * R$ 10,90/mês cada. Mesma mecânica do CNPJ adicional — entra no valor da
 * renovação, não é cobrança avulsa.
 *
 * A função async `calcularValorMensal(contaId, plano)` está em `precos.ts`
 * (server-only, usa Prisma). Esta versão sincrona é pra UI quando o número
 * de CNPJs já está em mãos.
 */
export const PRECO_BASE: Record<Plano, number> = {
  BASICO: 397,
  INTERMEDIARIO: 697,
  PREMIUM: 997,
};

export const PRECO_CNPJ_ADICIONAL = 39.9;

/**
 * Colaboradores além do titular que já vêm inclusos, por plano.
 *
 * Era 2 para todo mundo. Regina 24/09/2026, junto com a demanda de responsável
 * por fornecimento: *"temos que diferenciar o plano básico do intermediário
 * nesse ponto — no intermediário esse quantitativo deve ser de 4."* Faz
 * sentido: o Intermediário é o plano de quem tem 3 CNPJs e equipe, e cobrar
 * colaborador a partir do terceiro empurrava contra o próprio uso do plano.
 *
 * Premium acompanha o Intermediário, nunca menos — plano mais caro com menos
 * gente inclusa seria inversão. E continua NÃO sendo ilimitado: a decisão
 * antiga, mantida, é que o "ilimitado" do Premium vale para CNPJ, não para
 * gente com login.
 */
export const COLABORADORES_INCLUSOS_POR_PLANO: Record<Plano, number> = {
  BASICO: 2,
  INTERMEDIARIO: 4,
  PREMIUM: 4,
};

/** Compat: o valor do Básico, para código que ainda não sabe o plano. */
export const COLABORADORES_INCLUSOS = COLABORADORES_INCLUSOS_POR_PLANO.BASICO;
/** Mensalidade por colaborador acima do incluso (Regina 21/08). */
export const PRECO_COLABORADOR_ADICIONAL = 10.9;
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
  /** Colaboradores além do titular. */
  numColaboradores: number;
  colaboradoresAdicionais: number;
  valorColaboradores: number;
  valorTotal: number;
};

export function calcularBreakdown(
  plano: Plano,
  numCnpjs: number,
  numColaboradores = 0,
): BreakdownCobranca {
  const valorBase = PRECO_BASE[plano];
  const inclusos = CNPJS_INCLUSOS[plano];

  // O PREÇO do colaborador adicional é igual em qualquer plano — inclusive no
  // Premium, onde o ilimitado vale pra CNPJ, não pra gente com login. O que
  // muda por plano é quantos vêm inclusos.
  const colaboradoresAdicionais = Math.max(
    0,
    numColaboradores - COLABORADORES_INCLUSOS_POR_PLANO[plano],
  );
  const valorColaboradores = Number(
    (colaboradoresAdicionais * PRECO_COLABORADOR_ADICIONAL).toFixed(2),
  );

  const cnpjsAdicionais = inclusos === "ilimitado" ? 0 : Math.max(0, numCnpjs - inclusos);
  const valorAdicional = Number((cnpjsAdicionais * PRECO_CNPJ_ADICIONAL).toFixed(2));

  return {
    plano,
    valorBase,
    numCnpjs,
    cnpjsAdicionais,
    valorAdicional,
    numColaboradores,
    colaboradoresAdicionais,
    valorColaboradores,
    valorTotal: Number((valorBase + valorAdicional + valorColaboradores).toFixed(2)),
  };
}
