import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Régua de cobrança automatizada.
 *
 * Inspiração Netflix/Amazon: cliente assina sozinho, paga via gateway, e o sistema:
 * 1. Avisa 3 dias antes do vencimento.
 * 2. Marca ATRASADA quando vence + 3d sem pagamento.
 * 3. Tenta retry de cartão 2 dias após falha.
 * 4. Bloqueia o acesso 7 dias após atraso (statusAssinatura = INADIMPLENTE).
 *
 * Pode ser chamada por:
 * - Action manual (`executarReguaCobrancaAction`) — pelo super-admin
 * - Cron (`/api/cron/regua-cobranca`) — Vercel Cron diário
 */
export type ResumoRegua = {
  renovacoesGeradas: number;
  renovacoesIgnoradas: number;
  renovacoesErros: number;
  avisosVencimento: number;
  marcadasAtrasadas: number;
  contasBloqueadas: number;
  cartaoRetentar: number;
  comissoesAtrasadas: number;
  fixosGerados: number;
  fixosAtrasados: number;
  whatsAppPrazos: { porDias: Record<number, number>; hoje: number; atrasado: number };
  whatsAppPlanos: { em3d: number; atrasado: number };
  whatsAppNfPendente: number;
  whatsAppCartaoExpira: number;
  whatsAppAniversarios: number;
  comissoesEmbaixador: { competencia: string; vinculos: number; bonusIniciais: number; totalGeradoBRL: number };
};

export async function executarRegua(): Promise<ResumoRegua> {
  const hoje = new Date();
  const em3dias = new Date(hoje.getTime() + 3 * 86400000);
  const ha2dias = new Date(hoje.getTime() - 2 * 86400000);
  const ha3dias = new Date(hoje.getTime() - 3 * 86400000);
  const ha7dias = new Date(hoje.getTime() - 7 * 86400000);

  // 0. Gera renovação automática mensal pra contas ATIVAS vencendo
  //    Regina 23/06 — fecha o ciclo de cobrança recorrente.
  const { gerarRenovacoesMensais } = await import("@/lib/renovacaoAutomatica");
  const renov = await gerarRenovacoesMensais();

  // 1. Aviso de vencimento (3 dias antes) — registra evento; integração e-mail/WhatsApp pelo gateway
  const aVencer = await prisma.cobranca.findMany({
    where: { status: "PENDENTE", vencimento: { gte: hoje, lte: em3dias } },
    select: { id: true, contaId: true, vencimento: true },
  });
  for (const c of aVencer) {
    await prisma.eventoGateway.create({
      data: {
        cobrancaId: c.id,
        provider: "ASAAS",
        evento: "AVISO_VENCIMENTO_3D",
        payload: JSON.stringify({ dispatchedAt: hoje.toISOString() }),
      },
    });
  }

  // 2. Cartão falhado: tentar de novo após 2 dias
  const cartaoRetry = await prisma.cobranca.findMany({
    where: {
      status: "ATRASADA",
      forma: "CARTAO_CREDITO",
      tentativas: { lt: 3 },
      atualizadoEm: { lt: ha2dias },
    },
    select: { id: true },
  });
  for (const c of cartaoRetry) {
    // Em produção: chama API do gateway pra retentar a cobrança
    await prisma.cobranca.update({
      where: { id: c.id },
      data: {
        tentativas: { increment: 1 },
      },
    });
    await prisma.eventoGateway.create({
      data: {
        cobrancaId: c.id,
        provider: "ASAAS",
        evento: "CARTAO_RETRY",
        payload: JSON.stringify({ retriedAt: hoje.toISOString() }),
      },
    });
  }

  // 3. Vencidas há mais de 3 dias → ATRASADA
  const vencidas = await prisma.cobranca.findMany({
    where: { status: "PENDENTE", vencimento: { lt: ha3dias } },
    select: { id: true },
  });
  for (const c of vencidas) {
    await prisma.cobranca.update({ where: { id: c.id }, data: { status: "ATRASADA" } });
  }

  // 4. Contas com cobrança ATRASADA há mais de 7 dias → BLOQUEAR (paywall ativa)
  const aBloquear = await prisma.cobranca.findMany({
    where: { status: "ATRASADA", vencimento: { lt: ha7dias } },
    distinct: ["contaId"],
    select: { contaId: true },
  });
  for (const c of aBloquear) {
    await prisma.conta.update({
      where: { id: c.contaId },
      data: { statusAssinatura: "INADIMPLENTE", bloqueadoEm: new Date() },
    });
  }

  // 5. Marca comissões variáveis A_RECEBER como ATRASADO após 30 dias da
  // liberação. Janela padrão; analista pode reverter manualmente.
  const { marcarComissoesAtrasadas } = await import("@/lib/comissaoExecucao");
  const comissoesAtrasadas = await marcarComissoesAtrasadas(30);

  // 6. Gera as linhas de comissão fixa mensal do mês corrente para os vínculos
  // ativos (idempotente). E marca as A_RECEBER vencidas como ATRASADO.
  const { gerarLinhasComissaoFixaDoMes, marcarFixosAtrasados } = await import(
    "@/lib/comissaoFixa"
  );
  const fixosGerados = await gerarLinhasComissaoFixaDoMes();
  const fixosAtrasados = await marcarFixosAtrasados();

  // 7. Notificações WhatsApp diárias (Regina 02/07). Dispara pra todos os
  // usuarios com telefone cadastrado + opt-in ligado. Best-effort.
  const { executarNotificacoesDiarias } = await import("@/lib/notificacoesWhatsapp");
  const notifs = await executarNotificacoesDiarias();

  // 8. Comissoes do Programa Analista Parceiro — R$ 29,90/vinculo + bonus
  // R$ 500 na 1a fatura. Idempotente (upsert por competencia), pode rodar
  // todo dia sem duplicar. Regina 07/07.
  const { calcularComissoesDoMes } = await import("@/lib/comissaoEmbaixador");
  const comissEmb = await calcularComissoesDoMes().catch((e) => {
    console.error("[regua] erro em comissoes embaixador:", e);
    return { competencia: "", vinculos: 0, bonusIniciais: 0, totalGeradoBRL: 0 };
  });

  return {
    renovacoesGeradas: renov.geradas,
    renovacoesIgnoradas: renov.ignoradas,
    renovacoesErros: renov.erros,
    avisosVencimento: aVencer.length,
    marcadasAtrasadas: vencidas.length,
    contasBloqueadas: aBloquear.length,
    cartaoRetentar: cartaoRetry.length,
    comissoesAtrasadas,
    fixosGerados,
    fixosAtrasados,
    whatsAppPrazos: notifs.prazos,
    whatsAppPlanos: notifs.planos,
    whatsAppNfPendente: notifs.nfPendente.enviados,
    whatsAppCartaoExpira: notifs.cartaoExpira.enviados,
    whatsAppAniversarios: notifs.aniversario.enviados,
    comissoesEmbaixador: comissEmb,
  };
}
