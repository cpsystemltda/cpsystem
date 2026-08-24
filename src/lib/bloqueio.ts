import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Regra de bloqueio por falta de pagamento (Regina 24/08).
 *
 * "Não podemos deixar o cliente ficar usando o sistema sem o pagamento. Três
 * dias de atraso é bloqueado para uso. O cliente deve entrar no sistema e ser
 * direcionado para o pagamento, para continuar usando."
 *
 * Antes o bloqueio dependia só da régua diária, e ainda esperava 7 dias DEPOIS
 * de a cobrança virar ATRASADA — na prática, dez dias de uso sem pagar. Agora a
 * regra é avaliada também no acesso: a régua continua marcando status, mas quem
 * decide se a tela abre é esta função, no momento em que o cliente entra.
 */

export const TOLERANCIA_ATRASO_DIAS = 3;

export type MotivoBloqueio =
  | "TRIAL_EXPIRADO"
  | "INADIMPLENTE"
  | "CANCELADA"
  | "COBRANCA_VENCIDA"
  | null;

export type Bloqueio = {
  bloqueada: boolean;
  motivo: MotivoBloqueio;
  /** Vencimento da cobrança mais antiga em aberto, quando houver. */
  vencidaEm: Date | null;
  diasDeAtraso: number;
};

const LIVRE: Bloqueio = { bloqueada: false, motivo: null, vencidaEm: null, diasDeAtraso: 0 };

export function limiteDeAtraso(agora = new Date()): Date {
  return new Date(agora.getTime() - TOLERANCIA_ATRASO_DIAS * 86400000);
}

export async function avaliarBloqueio(conta: {
  id: string;
  tipo: string;
  statusAssinatura: string;
  trialAteEm: Date | null;
}): Promise<Bloqueio> {
  // Analista não paga assinatura — nunca entra nessa régua.
  if (conta.tipo !== "EMPRESA") return LIVRE;

  const agora = new Date();

  // Cobrança em aberto vencida além da tolerância. Vale mesmo se a régua ainda
  // não tiver rodado hoje: é a pergunta feita na hora do acesso.
  const vencida = await prisma.cobranca.findFirst({
    where: {
      contaId: conta.id,
      status: { in: ["PENDENTE", "PROCESSANDO", "ATRASADA"] },
      vencimento: { lt: limiteDeAtraso(agora) },
    },
    orderBy: { vencimento: "asc" },
    select: { vencimento: true },
  });

  if (vencida) {
    const dias = Math.floor((agora.getTime() - vencida.vencimento.getTime()) / 86400000);
    return {
      bloqueada: true,
      motivo: "COBRANCA_VENCIDA",
      vencidaEm: vencida.vencimento,
      diasDeAtraso: dias,
    };
  }

  if (conta.statusAssinatura === "INADIMPLENTE") {
    return { ...LIVRE, bloqueada: true, motivo: "INADIMPLENTE" };
  }
  if (conta.statusAssinatura === "CANCELADA") {
    return { ...LIVRE, bloqueada: true, motivo: "CANCELADA" };
  }
  if (conta.statusAssinatura === "TRIAL" && conta.trialAteEm && conta.trialAteEm < agora) {
    return { ...LIVRE, bloqueada: true, motivo: "TRIAL_EXPIRADO" };
  }

  return LIVRE;
}
