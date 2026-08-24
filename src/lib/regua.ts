import "server-only";
import { prisma } from "@/lib/prisma";
import { limiteDeAtraso } from "@/lib/bloqueio";
import { COBRANCAS_DE_CLIENTE } from "@/lib/contaInterna";

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
  whatsAppResumo: { janela: string; usuariosNotificados: number; capAtingido: number; semItems: number };
  comissoesEmbaixador: { competencia: string; vinculos: number; totalGeradoBRL: number };
  trialAvisados: number;
  /** Avisos de fatura vencida (cliente e analista do cliente). */
  atrasoClientesAvisados: number;
  atrasoAnalistasAvisados: number;
  /** Comissões de analista repassadas por PIX nesta execução. */
  comissoesRepassadas: number;
  comissoesRepasseFalhou: number;
};

export async function executarRegua(): Promise<ResumoRegua> {
  const hoje = new Date();
  const em3dias = new Date(hoje.getTime() + 3 * 86400000);
  const ha2dias = new Date(hoje.getTime() - 2 * 86400000);

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

  // 3. Passou do vencimento → ATRASADA.
  // Antes esperava 3 dias pra marcar; agora os 3 dias são a tolerância ATÉ o
  // bloqueio (Regina 24/08), então a cobrança já nasce atrasada no dia seguinte
  // ao vencimento — é o que o cliente vê na tela de assinatura.
  const vencidas = await prisma.cobranca.findMany({
    where: { status: "PENDENTE", vencimento: { lt: hoje }, ...COBRANCAS_DE_CLIENTE },
    select: { id: true },
  });
  for (const c of vencidas) {
    await prisma.cobranca.update({ where: { id: c.id }, data: { status: "ATRASADA" } });
  }

  // 4. Cobrança em aberto vencida há mais de 3 dias → BLOQUEIA a conta.
  // Regina 24/08: "três dias de atraso é bloqueado para uso". Antes eram 7 dias
  // depois de virar ATRASADA (que por sua vez já esperava 3) — dez dias de uso
  // sem pagar. O acesso também confere isso em tempo real (`@/lib/bloqueio`);
  // aqui a régua persiste o status pra relatório e cobrança.
  const aBloquear = await prisma.cobranca.findMany({
    where: {
      status: { in: ["PENDENTE", "PROCESSANDO", "ATRASADA"] },
      vencimento: { lt: limiteDeAtraso(hoje) },
      // Conta interna não é cliente: não vira inadimplente nem bloqueia.
      ...COBRANCAS_DE_CLIENTE,
    },
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

  // 8. Comissoes do Programa Analista Parceiro — R$ 29,90/vinculo ativo
  // (recorrente vitalicio). Idempotente (upsert por competencia), pode
  // rodar todo dia sem duplicar. Regina 07/07.
  const { calcularComissoesDoMes } = await import("@/lib/comissaoEmbaixador");
  const comissEmb = await calcularComissoesDoMes().catch((e) => {
    console.error("[regua] erro em comissoes embaixador:", e);
    return { competencia: "", vinculos: 0, totalGeradoBRL: 0 };
  });

  // 8b. Comissao do analista: paga assim que o dinheiro do cliente esta em
  // conta, sem esperar o dia 20 (Regina 24/08: "nao quero que acumule, quero
  // que seja pago quando for em conta"). O caso do Igor: o cliente pagou um dia
  // DEPOIS da data de repasse, e a comissao ficaria parada ate o mes seguinte.
  // Idempotente — comissao paga nao volta pra fila.
  const { pagarComissoesDoMesAnterior } = await import("@/lib/pagamentoAnalista");
  const repasses = await pagarComissoesDoMesAnterior(hoje).catch((e) => {
    console.error("[regua] erro no repasse de comissoes:", e);
    return { competenciaPaga: "", tentativas: 0, sucessos: 0, falhas: 0, totalPagoBRL: 0 };
  });

  // 8c. Atraso de pagamento: avisa o cliente (fatura vencida, bloqueio em 3
  // dias) e o analista (o atraso do cliente segura a comissao dele). Regina
  // 24/08. Best-effort — nunca derruba o resto da regua.
  const { notificarAtrasoDePagamento } = await import("@/lib/notificacoesWhatsapp");
  const atrasos = await notificarAtrasoDePagamento(hoje).catch((e) => {
    console.error("[regua] erro nos avisos de atraso:", e);
    return { clientesAvisados: 0, analistasAvisados: 0 };
  });

  // 9. Fim de trial (Regina 06/08) — avisa em D-3 e D-1 que a cobranca vai
  // comecar. O cartao ja foi tokenizado no signup, entao sem aviso o cliente
  // e cobrado de surpresa. Best-effort: nunca derruba o resto da regua.
  const { notificarTrialVencendo } = await import("@/lib/notificacoesWhatsapp");
  const trial = await notificarTrialVencendo().catch((e) => {
    console.error("[regua] erro no aviso de fim de trial:", e);
    return { avisados: 0 };
  });

  return {
    atrasoClientesAvisados: atrasos.clientesAvisados,
    atrasoAnalistasAvisados: atrasos.analistasAvisados,
    comissoesRepassadas: repasses.sucessos,
    comissoesRepasseFalhou: repasses.falhas,
    trialAvisados: trial.avisados,
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
    whatsAppResumo: notifs,
    comissoesEmbaixador: comissEmb,
  };
}
