import "server-only";
import type { Plano } from "@/generated/prisma/client";

// Regina 21/07/2026: conciliacao bancaria disponivel em INTERMEDIARIO e PREMIUM.
// BASICO NAO tem acesso por padrao.
export const PLANOS_COM_CONCILIACAO: Plano[] = ["INTERMEDIARIO", "PREMIUM"];

// Regina 30/07/2026: conta BASICO pode ganhar CORTESIA temporaria — quando
// setada, a conciliacao fica liberada ate a data indicada. Leo Santos foi
// o 1o beneficiado (30 dias).
export type ContaConciliacaoInfo = {
  plano: Plano;
  conciliacaoCortesiaAte: Date | null;
};

export function contaTemAcessoConciliacao(conta: ContaConciliacaoInfo): boolean {
  if (PLANOS_COM_CONCILIACAO.includes(conta.plano)) return true;
  return cortesiaConciliacaoAtiva(conta);
}

export function cortesiaConciliacaoAtiva(conta: ContaConciliacaoInfo): boolean {
  if (!conta.conciliacaoCortesiaAte) return false;
  return conta.conciliacaoCortesiaAte.getTime() > Date.now();
}
