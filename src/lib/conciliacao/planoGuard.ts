import "server-only";
import type { Plano } from "@/generated/prisma/client";

// Regina 21/07/2026: conciliacao bancaria disponivel em INTERMEDIARIO e PREMIUM.
// BASICO NAO tem acesso.
export const PLANOS_COM_CONCILIACAO: Plano[] = ["INTERMEDIARIO", "PREMIUM"];

export function contaTemAcessoConciliacao(plano: Plano): boolean {
  return PLANOS_COM_CONCILIACAO.includes(plano);
}
