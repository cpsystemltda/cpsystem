import "server-only";
import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";
import { janelaExecucao, prazoLimiteOuVigencia } from "@/lib/prazoEntrega";
import type {
  Empenho,
  StatusExecucao,
  InstrumentoContratual,
} from "@/generated/prisma/client";

// Templates + orquestracao das notificacoes WhatsApp (Regina 02/07).
// Cada handler:
//   1. Identifica os usuarios destinatarios (todos os da conta com
//      telefone cadastrado + opt-in ligado)
//   2. Monta a mensagem com dados do evento
//   3. Chama dispararNotificacao (que cuida de idempotencia + registro)

const LABEL_INSTRUMENTO: Record<InstrumentoContratual, string> = {
  NOTA_EMPENHO: "Nota de Empenho",
  CARTA_CONTRATO: "Carta-Contrato",
  AUTORIZACAO_COMPRA: "Autorização de Compra",
  AUTORIZACAO_ENTREGA: "Autorização de Entrega",
  ORDEM_SERVICO: "Ordem de Serviço",
};

const LABEL_STATUS: Record<StatusExecucao, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito",
  ENTREGUE: "Entregue",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  PAGO: "Pago",
};

// Retorna usuarios da conta que estao aptos a receber notificacao WhatsApp.
async function destinatariosDaConta(contaId: string) {
  return prisma.usuario.findMany({
    where: {
      contaId,
      optInWhatsApp: true,
      telefoneWhatsApp: { not: null },
    },
    select: { id: true, nome: true, telefoneWhatsApp: true },
  });
}

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function primeiroNome(nome: string): string {
  return nome.split(" ")[0] || nome;
}

// ==================== EVENT-DRIVEN ====================

// Novo empenho / ata / contrato criado — confirmacao pro cliente.
export async function notificarNovoDocumento(opts: {
  contaId: string;
  tipo: "ATA" | "CONTRATO" | "EMPENHO";
  documentoId: string;
  numero: string;
  orgao: string;
  valor?: number;
}) {
  const usuarios = await destinatariosDaConta(opts.contaId);
  const rotulo =
    opts.tipo === "ATA"
      ? "Ata"
      : opts.tipo === "CONTRATO"
        ? "Contrato"
        : "Empenho";
  for (const u of usuarios) {
    const mensagem =
      `✅ *${rotulo} cadastrado no CP System*\n\n` +
      `Olá, ${primeiroNome(u.nome)}!\n\n` +
      `${rotulo} *${opts.numero}* — ${opts.orgao}\n` +
      (opts.valor ? `Valor: ${brl(opts.valor)}\n` : "") +
      `\nAcesse pra ver detalhes: https://cpsystem.app.br/execucao/${opts.documentoId}`;

    await dispararNotificacao({
      usuarioId: u.id,
      tipo:
        opts.tipo === "ATA" ? "VENCIMENTO_EMPENHO" :  // reaproveita — nao afeta idempot pq referenciaId muda
        opts.tipo === "CONTRATO" ? "VENCIMENTO_EMPENHO" :
        "VENCIMENTO_EMPENHO",
      referenciaId: `novo-${opts.tipo}-${opts.documentoId}`,
      mensagem,
    });
  }
}

// Empenho mudou de status — avanço na execução (ENTREGUE, NF_EMITIDA, PAGO).
export async function notificarMudancaStatus(opts: {
  contaId: string;
  empenhoId: string;
  numeroEmpenho: string;
  instrumento: InstrumentoContratual;
  orgao: string;
  novoStatus: StatusExecucao;
}) {
  // So notifica marcos importantes (evita spam pra cada micro-passo).
  const marcosImportantes: StatusExecucao[] = [
    "ENTREGUE",
    "NF_EMITIDA",
    "NF_ENCAMINHADA",
    "PAGO",
  ];
  if (!marcosImportantes.includes(opts.novoStatus)) return;

  const usuarios = await destinatariosDaConta(opts.contaId);
  const emoji =
    opts.novoStatus === "ENTREGUE"
      ? "📦"
      : opts.novoStatus === "NF_EMITIDA"
        ? "📄"
        : opts.novoStatus === "NF_ENCAMINHADA"
          ? "📬"
          : opts.novoStatus === "PAGO"
            ? "💰"
            : "✔️";

  for (const u of usuarios) {
    const mensagem =
      `${emoji} *${LABEL_STATUS[opts.novoStatus]}*\n\n` +
      `Olá, ${primeiroNome(u.nome)}!\n\n` +
      `${LABEL_INSTRUMENTO[opts.instrumento]} *${opts.numeroEmpenho}* — ${opts.orgao}\n` +
      `agora está *${LABEL_STATUS[opts.novoStatus].toUpperCase()}*.\n\n` +
      `Detalhes: https://cpsystem.app.br/execucao/${opts.empenhoId}`;

    await dispararNotificacao({
      usuarioId: u.id,
      tipo: opts.novoStatus === "ENTREGUE" ? "ENTREGA_HOJE" : "VENCIMENTO_EMPENHO",
      referenciaId: `status-${opts.empenhoId}-${opts.novoStatus}`,
      mensagem,
    });
  }
}

// ==================== CRON DIARIO ====================

// Cadencia escalonada de alertas (Igor 03/07):
// 90d → planejamento estratégico
// 60d → preparação de documentação
// 30d → ação intermediária
// 15d → ação prioritária
// 10d → última chance de manobra
//  5d → crítico, agora ou nunca
const CADENCIA_DIAS = [90, 60, 30, 15, 10, 5] as const;

function tomPorDias(dias: number): { emoji: string; urgencia: string; cta: string } {
  if (dias >= 90) return { emoji: "🗓️", urgencia: "Planejamento", cta: "Comece a organizar a renovação/aditivo desde já." };
  if (dias >= 60) return { emoji: "📋", urgencia: "Preparar documentação", cta: "Reúna os documentos necessários e alinhe com o órgão." };
  if (dias >= 30) return { emoji: "📆", urgencia: "Ação intermediária", cta: "Programe renovação, aditivo ou uso do saldo." };
  if (dias >= 15) return { emoji: "⚠️", urgencia: "Ação prioritária", cta: "Formalize a próxima etapa esta semana." };
  if (dias >= 10) return { emoji: "🔔", urgencia: "Última chance de manobra", cta: "Se ainda não iniciou o processo, comece hoje." };
  return { emoji: "🚨", urgencia: "Crítico — agora ou nunca", cta: "Regularize hoje pra evitar interrupção contratual." };
}

// Cron consolidado (Regina 06/07): antes eram 3 funcoes separadas
// (notificarPrazosEmpenho + notificarVencimentosCarteira + notificarGarantiaVencendo),
// cada uma disparando 1 msg por documento. Com cadencia 6x (90/60/30/15/10/5)
// vira flood se o usuario tem varios docs vencendo. Agora: UMA msg diaria
// por usuario por janela consolidando TODOS os documentos (empenhos + atas +
// contratos + garantias) daquela janela.
//
// Empenhos ATRASADOS e ENTREGAS DE HOJE continuam individuais — sao criticos
// e merecem destaque, nao devem se perder numa lista.
type ItemPorConta = {
  empenhos: { id: string; numero: string; orgao: string; label: string; data: Date }[];
  atas: { id: string; numero: string; orgao: string; data: Date }[];
  contratos: { id: string; numero: string; orgao: string; data: Date }[];
  garantias: { id: string; numero: string; orgao: string; modalidade: string; data: Date }[];
};

function novaConta(): ItemPorConta {
  return { empenhos: [], atas: [], contratos: [], garantias: [] };
}

function totalConta(c: ItemPorConta): number {
  return c.empenhos.length + c.atas.length + c.contratos.length + c.garantias.length;
}

function formatarSecao<T>(
  emoji: string,
  titulo: string,
  itens: T[],
  formatar: (item: T) => string,
): string {
  if (!itens.length) return "";
  return `${emoji} *${titulo}*\n${itens.map((i) => `• ${formatar(i)}`).join("\n")}\n\n`;
}

export async function notificarPrazosConsolidado(hoje: Date = new Date()): Promise<{
  porDias: Record<number, number>; // msgs consolidadas enviadas por janela
  hoje: number; // entregas de empenho hoje
  atrasado: number; // empenhos atrasados
}> {
  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);
  const amanha = new Date(inicioHoje.getTime() + 86400000);
  const hojeStr = inicioHoje.toISOString().slice(0, 10);

  const porDias: Record<number, number> = Object.fromEntries(CADENCIA_DIAS.map((d) => [d, 0]));
  let hojeCount = 0;
  let atrasadoCount = 0;

  // === 1. HOJE + ATRASADO (empenhos) — msgs individuais, criticas ===
  const empenhosAtivos = await prisma.empenho.findMany({
    where: { status: { in: ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"] } },
    select: {
      id: true,
      numero: true,
      instrumento: true,
      orgaoNome: true,
      status: true,
      vigenciaFim: true,
      dataPrevistaExecucao: true,
      prazoEntregaModo: true,
      dataEntregaCerta: true,
      dataEntregaInicio: true,
      dataEntregaFim: true,
      dataPedidoRecebido: true,
      prazoEntregaDias: true,
      prazoEntregaUnidade: true,
      empresa: { select: { contaId: true } },
    },
  });

  for (const e of empenhosAtivos) {
    const janela = janelaExecucao(e);
    const limite = janela.fim;
    const contaId = e.empresa.contaId;
    const label = LABEL_INSTRUMENTO[e.instrumento];
    const url = `https://cpsystem.app.br/execucao/${e.id}`;

    if (limite < inicioHoje) {
      const diasAtraso = Math.floor((inicioHoje.getTime() - limite.getTime()) / 86400000);
      const usuarios = await destinatariosDaConta(contaId);
      for (const u of usuarios) {
        const msg =
          `🚨 *EMPENHO ATRASADO*\n\n` +
          `${primeiroNome(u.nome)}, o ${label} *${e.numero}* (${e.orgaoNome}) está atrasado *${diasAtraso} dia(s)*.\n\n` +
          `Regularize urgente pra evitar multa contratual: ${url}`;
        const r = await dispararNotificacao({
          usuarioId: u.id,
          tipo: "VENCIMENTO_EMPENHO",
          referenciaId: `atrasado-${e.id}-${hojeStr}`,
          mensagem: msg,
        });
        if (r.enviado) atrasadoCount++;
      }
      continue;
    }

    if (limite >= inicioHoje && limite < amanha) {
      const usuarios = await destinatariosDaConta(contaId);
      for (const u of usuarios) {
        const msg =
          `⏰ *ENTREGA HOJE*\n\n` +
          `${primeiroNome(u.nome)}, hoje é o último dia pra entregar o ${label} *${e.numero}* (${e.orgaoNome}).\n\n` +
          `Confirme a entrega no sistema: ${url}`;
        const r = await dispararNotificacao({
          usuarioId: u.id,
          tipo: "ENTREGA_HOJE",
          referenciaId: `hoje-${e.id}-${hojeStr}`,
          mensagem: msg,
        });
        if (r.enviado) hojeCount++;
      }
    }
  }

  // === 2. CADENCIA ESCALONADA — msg CONSOLIDADA por (conta, janela) ===
  for (const dias of CADENCIA_DIAS) {
    const inicio = new Date(inicioHoje.getTime() + dias * 86400000);
    const fim = new Date(inicioHoje.getTime() + (dias + 1) * 86400000);

    const porConta = new Map<string, ItemPorConta>();
    function push(contaId: string): ItemPorConta {
      let c = porConta.get(contaId);
      if (!c) {
        c = novaConta();
        porConta.set(contaId, c);
      }
      return c;
    }

    // Empenhos: precisa iterar todos (janelaExecucao nao e query SQL)
    for (const e of empenhosAtivos) {
      const limite = janelaExecucao(e).fim;
      if (limite < inicio || limite >= fim) continue;
      push(e.empresa.contaId).empenhos.push({
        id: e.id,
        numero: e.numero,
        orgao: e.orgaoNome,
        label: LABEL_INSTRUMENTO[e.instrumento],
        data: limite,
      });
    }

    const atas = await prisma.ata.findMany({
      where: { vigenciaFim: { gte: inicio, lt: fim } },
      select: { id: true, numero: true, orgaoNome: true, vigenciaFim: true, empresa: { select: { contaId: true } } },
    });
    for (const a of atas) {
      push(a.empresa.contaId).atas.push({ id: a.id, numero: a.numero, orgao: a.orgaoNome, data: a.vigenciaFim });
    }

    const contratos = await prisma.contrato.findMany({
      where: { vigenciaFim: { gte: inicio, lt: fim } },
      select: { id: true, numero: true, orgaoNome: true, vigenciaFim: true, empresa: { select: { contaId: true } } },
    });
    for (const c of contratos) {
      push(c.empresa.contaId).contratos.push({ id: c.id, numero: c.numero, orgao: c.orgaoNome, data: c.vigenciaFim });
    }

    const garantias = await prisma.garantia.findMany({
      where: { dataFim: { gte: inicio, lt: fim } },
      select: {
        id: true,
        modalidade: true,
        dataFim: true,
        empenho: { select: { numero: true, orgaoNome: true, empresa: { select: { contaId: true } } } },
        contrato: { select: { numero: true, orgaoNome: true, empresa: { select: { contaId: true } } } },
      },
    });
    for (const g of garantias) {
      const doc = g.empenho ?? g.contrato;
      if (!doc || !g.dataFim) continue;
      push(doc.empresa.contaId).garantias.push({
        id: g.id,
        numero: doc.numero,
        orgao: doc.orgaoNome,
        modalidade: g.modalidade,
        data: g.dataFim,
      });
    }

    const t = tomPorDias(dias);
    for (const [contaId, itens] of porConta) {
      if (totalConta(itens) === 0) continue;
      const usuarios = await destinatariosDaConta(contaId);
      for (const u of usuarios) {
        const total = totalConta(itens);
        const cabecalho =
          `${t.emoji} *Vencimentos em ${dias} dia${dias > 1 ? "s" : ""}*\n\n` +
          `${primeiroNome(u.nome)}, você tem *${total} ${total === 1 ? "item" : "itens"}* vencendo em ${dias} dia${dias > 1 ? "s" : ""}:\n\n`;

        const secoes =
          formatarSecao("📦", "Empenhos/Instrumentos", itens.empenhos, (i) =>
            `${i.label} ${i.numero} — ${i.orgao} (${i.data.toLocaleDateString("pt-BR")})`,
          ) +
          formatarSecao("📄", "Atas", itens.atas, (i) =>
            `${i.numero} — ${i.orgao} (${i.data.toLocaleDateString("pt-BR")})`,
          ) +
          formatarSecao("📋", "Contratos", itens.contratos, (i) =>
            `${i.numero} — ${i.orgao} (${i.data.toLocaleDateString("pt-BR")})`,
          ) +
          formatarSecao("🛡️", "Garantias", itens.garantias, (i) =>
            `${i.numero} — ${i.orgao} · ${i.modalidade} (${i.data.toLocaleDateString("pt-BR")})`,
          );

        const rodape =
          `_${t.urgencia}_ — ${t.cta}\n\n` +
          `Ver tudo: https://cpsystem.app.br/dashboard`;

        const r = await dispararNotificacao({
          usuarioId: u.id,
          tipo: "VENCIMENTO_EMPENHO",
          referenciaId: `consolidado-d${dias}-${u.id}-${hojeStr}`,
          mensagem: cabecalho + secoes + rodape,
        });
        if (r.enviado) porDias[dias]++;
      }
    }
  }

  return { porDias, hoje: hojeCount, atrasado: atrasadoCount };
}

// Notifica cobranças CP System (assinatura Asaas) vencendo em 3 dias ou em atraso.
export async function notificarVencimentosPlano(hoje: Date = new Date()): Promise<{
  em3d: number;
  atrasado: number;
}> {
  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);
  const em3d = new Date(inicioHoje.getTime() + 3 * 86400000);
  const em4d = new Date(inicioHoje.getTime() + 4 * 86400000);
  const hojeStr = inicioHoje.toISOString().slice(0, 10);

  const cobrancas = await prisma.cobranca.findMany({
    where: {
      OR: [
        { status: "PENDENTE", vencimento: { gte: em3d, lt: em4d } },
        { status: "ATRASADA" },
      ],
    },
    select: {
      id: true,
      contaId: true,
      valor: true,
      vencimento: true,
      status: true,
      gatewayInvoiceUrl: true,
    },
  });

  let em3dCount = 0;
  let atrasadoCount = 0;

  for (const c of cobrancas) {
    const usuarios = await destinatariosDaConta(c.contaId);
    for (const u of usuarios) {
      const urlPagar = c.gatewayInvoiceUrl || "https://cpsystem.app.br/conta/assinatura";
      let msg: string;
      let tipo: "VENCIMENTO_PLANO" | "PLANO_ATRASADO";
      let ref: string;

      if (c.status === "ATRASADA") {
        const diasAtraso = Math.floor((inicioHoje.getTime() - c.vencimento.getTime()) / 86400000);
        msg =
          `🔴 *Sua fatura CP System está em atraso*\n\n` +
          `${primeiroNome(u.nome)}, sua mensalidade de ${brl(c.valor)} está atrasada há ${diasAtraso} dia(s).\n\n` +
          `⚠️ Sua conta pode ser bloqueada se não for regularizada.\n\n` +
          `Pagar agora: ${urlPagar}`;
        tipo = "PLANO_ATRASADO";
        ref = `atraso-${c.id}-${hojeStr}`;
      } else {
        msg =
          `💳 *Sua fatura CP System vence em 3 dias*\n\n` +
          `${primeiroNome(u.nome)}, sua mensalidade de ${brl(c.valor)} vence em ${c.vencimento.toLocaleDateString("pt-BR")}.\n\n` +
          `Pagar antecipado: ${urlPagar}`;
        tipo = "VENCIMENTO_PLANO";
        ref = `3d-${c.id}`;
      }

      const r = await dispararNotificacao({
        usuarioId: u.id,
        tipo,
        referenciaId: ref,
        mensagem: msg,
      });
      if (r.enviado) {
        if (c.status === "ATRASADA") atrasadoCount++;
        else em3dCount++;
      }
    }
  }

  return { em3d: em3dCount, atrasado: atrasadoCount };
}

// ==================== CRON SEMANAL ====================

// Sexta 8h — resumo geral da conta pra cada usuario com opt-in.
export async function enviarResumoSemanal(hoje: Date = new Date()): Promise<{
  enviados: number;
}> {
  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);
  const em7d = new Date(inicioHoje.getTime() + 7 * 86400000);
  const em30d = new Date(inicioHoje.getTime() + 30 * 86400000);

  // Chave da semana pra idempotencia (ISO week YYYY-Www)
  const ano = inicioHoje.getFullYear();
  const jan1 = new Date(ano, 0, 1);
  const diasAno = Math.floor((inicioHoje.getTime() - jan1.getTime()) / 86400000);
  const semana = Math.ceil((diasAno + jan1.getDay() + 1) / 7);
  const semanaKey = `${ano}-W${String(semana).padStart(2, "0")}`;

  const contas = await prisma.conta.findMany({
    where: { statusAssinatura: { in: ["ATIVA", "TRIAL"] } },
    select: { id: true },
  });

  let enviados = 0;

  for (const conta of contas) {
    const usuarios = await destinatariosDaConta(conta.id);
    if (!usuarios.length) continue;

    // Agrega dados da conta
    const [
      empenhosPendentes,
      empenhosEntreguesSemana,
      atasVencendo,
      contratosVencendo,
      empenhosVencendo,
      cobrancasPendentes,
    ] = await Promise.all([
      prisma.empenho.count({
        where: {
          empresa: { contaId: conta.id },
          status: { in: ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"] },
        },
      }),
      prisma.empenho.count({
        where: {
          empresa: { contaId: conta.id },
          status: { in: ["ENTREGUE", "NF_EMITIDA", "NF_ENCAMINHADA", "PAGO"] },
          atualizadoEm: { gte: new Date(inicioHoje.getTime() - 7 * 86400000) },
        },
      }),
      prisma.ata.count({
        where: { empresa: { contaId: conta.id }, vigenciaFim: { gte: inicioHoje, lt: em30d } },
      }),
      prisma.contrato.count({
        where: { empresa: { contaId: conta.id }, vigenciaFim: { gte: inicioHoje, lt: em30d } },
      }),
      prisma.empenho.count({
        where: {
          empresa: { contaId: conta.id },
          status: { in: ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"] },
          OR: [
            { dataEntregaCerta: { gte: inicioHoje, lt: em7d } },
            { dataEntregaFim: { gte: inicioHoje, lt: em7d } },
            { dataPrevistaExecucao: { gte: inicioHoje, lt: em7d } },
          ],
        },
      }),
      prisma.cobranca.count({
        where: { contaId: conta.id, status: { in: ["PENDENTE", "ATRASADA"] } },
      }),
    ]);

    for (const u of usuarios) {
      const linhas: string[] = [
        `📊 *Resumo da semana — CP System*`,
        ``,
        `Bom dia, ${primeiroNome(u.nome)}! Aqui está o panorama da sua conta:`,
        ``,
        `📦 *Execução*`,
        `• Empenhos em andamento: ${empenhosPendentes}`,
        `• Concluídos nesta semana: ${empenhosEntreguesSemana}`,
        `• Vencendo nos próximos 7 dias: ${empenhosVencendo}`,
        ``,
        `📅 *Carteira (Atas + Contratos)*`,
        `• Vencendo em até 30 dias: ${atasVencendo + contratosVencendo}`,
        ``,
      ];
      if (cobrancasPendentes > 0) {
        linhas.push(`💳 *Financeiro*`);
        linhas.push(`• Faturas em aberto: ${cobrancasPendentes}`);
        linhas.push(``);
      }
      // Pontos de atenção
      const alertas: string[] = [];
      if (empenhosVencendo > 0) alertas.push(`⚠️ ${empenhosVencendo} empenho(s) com prazo na semana`);
      if (atasVencendo + contratosVencendo > 0)
        alertas.push(`📌 ${atasVencendo + contratosVencendo} documento(s) vencendo em 30 dias`);
      if (cobrancasPendentes > 0) alertas.push(`💰 ${cobrancasPendentes} fatura(s) pendente(s)`);

      if (alertas.length) {
        linhas.push(`🔔 *Pontos de atenção*`);
        alertas.forEach((a) => linhas.push(`• ${a}`));
        linhas.push(``);
      }
      linhas.push(`Bom final de semana! 🚀`);
      linhas.push(``);
      linhas.push(`Detalhes completos: https://cpsystem.app.br/dashboard`);

      const r = await dispararNotificacao({
        usuarioId: u.id,
        tipo: "RELATORIO_SEMANAL",
        referenciaId: semanaKey,
        mensagem: linhas.join("\n"),
      });
      if (r.enviado) enviados++;
    }
  }

  return { enviados };
}

// ==================== FASE 2 — CRON ====================

// NF emitida ou encaminhada ha 30+ dias sem PAGO. Cliente pode acionar
// cobranca do orgao (juros art. 141 Lei 14.133).
export async function notificarNfSemPagamento30d(hoje: Date = new Date()): Promise<{ enviados: number }> {
  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);
  const ha30d = new Date(inicioHoje.getTime() - 30 * 86400000);
  const hojeStr = inicioHoje.toISOString().slice(0, 10);

  const empenhos = await prisma.empenho.findMany({
    where: {
      status: { in: ["NF_EMITIDA", "NF_ENCAMINHADA"] },
      OR: [
        { dataNfEncaminhada: { lte: ha30d } },
        { AND: [{ dataNfEncaminhada: null }, { dataNfEmitida: { lte: ha30d } }] },
      ],
    },
    select: {
      id: true, numero: true, orgaoNome: true, instrumento: true,
      dataNfEmitida: true, dataNfEncaminhada: true,
      itens: { select: { valorTotal: true } },
      empresa: { select: { contaId: true } },
    },
  });

  let enviados = 0;
  for (const e of empenhos) {
    const usuarios = await destinatariosDaConta(e.empresa.contaId);
    if (!usuarios.length) continue;
    const valorTotal = e.itens.reduce((s, i) => s + i.valorTotal, 0);
    const dataNf = e.dataNfEncaminhada ?? e.dataNfEmitida;
    const diasSemPago = dataNf ? Math.floor((inicioHoje.getTime() - dataNf.getTime()) / 86400000) : 30;
    for (const u of usuarios) {
      const msg =
        `💸 *NF sem pagamento há ${diasSemPago} dias*\n\n` +
        `${primeiroNome(u.nome)}, o ${LABEL_INSTRUMENTO[e.instrumento]} *${e.numero}* (${e.orgaoNome}) teve NF encaminhada há mais de 30 dias e ainda não foi pago.\n\n` +
        `Valor: ${brl(valorTotal)}\n\n` +
        `Você pode acionar a cobrança do órgão (juros art. 141, Lei 14.133/2021).\n\nDetalhes: https://cpsystem.app.br/execucao/${e.id}`;
      const r = await dispararNotificacao({
        usuarioId: u.id,
        tipo: "NF_SEM_PAGAMENTO_30D",
        referenciaId: `nf30-${e.id}-${hojeStr}`,
        mensagem: msg,
      });
      if (r.enviado) enviados++;
    }
  }
  return { enviados };
}

// Cartao de credito da assinatura CP System expirando nos proximos 30 dias.
export async function notificarCartaoExpirando(hoje: Date = new Date()): Promise<{ enviados: number }> {
  const inicioHoje = new Date(hoje);
  inicioHoje.setHours(0, 0, 0, 0);
  const hojeStr = inicioHoje.toISOString().slice(0, 10);
  const mesAtual = inicioHoje.getMonth() + 1;
  const anoAtual = inicioHoje.getFullYear();

  // Cartoes com validade neste mes ou proximo
  const cartoes = await prisma.metodoPagamento.findMany({
    where: {
      forma: "CARTAO_CREDITO",
      padrao: true,
      OR: [
        { validadeAno: anoAtual, validadeMes: { gte: mesAtual, lte: mesAtual + 1 } },
        // dezembro deste ano -> janeiro proximo
        ...(mesAtual === 12
          ? [{ validadeAno: anoAtual + 1, validadeMes: 1 }]
          : []),
      ],
    },
    select: { contaId: true, bandeira: true, ultimosDigitos: true, validadeMes: true, validadeAno: true },
  });

  let enviados = 0;
  for (const c of cartoes) {
    const usuarios = await destinatariosDaConta(c.contaId);
    for (const u of usuarios) {
      const msg =
        `💳 *Seu cartão do CP System vence em breve*\n\n` +
        `${primeiroNome(u.nome)}, o ${c.bandeira || "cartão"} final *${c.ultimosDigitos}* vence em ${String(c.validadeMes).padStart(2, "0")}/${c.validadeAno}.\n\n` +
        `Atualize antes pra sua assinatura não ser interrompida:\n` +
        `https://cpsystem.app.br/conta/assinatura`;
      const r = await dispararNotificacao({
        usuarioId: u.id,
        tipo: "CARTAO_EXPIRANDO",
        referenciaId: `cartao-${c.ultimosDigitos}-${c.validadeMes}-${c.validadeAno}`,
        mensagem: msg,
      });
      if (r.enviado) enviados++;
    }
  }
  return { enviados };
}

// Garantia contratual vencendo em ate 60 dias.
// notificarGarantiaVencendo foi consolidada em notificarPrazosConsolidado
// (Regina 06/07 — todos os prazos por janela viram 1 msg unica por usuario).

// ==================== FASE 2 — EVENT-DRIVEN ====================

// Novo procedimento apuratorio aberto (multa/penalidade a possivel).
export async function notificarProcedimentoApuratorio(opts: {
  contaId: string;
  procedimentoId: string;
  assunto: string;
  orgao: string;
  prazoDefesaDias: number | null;
}) {
  const usuarios = await destinatariosDaConta(opts.contaId);
  for (const u of usuarios) {
    const prazo = opts.prazoDefesaDias ? `\n\n⏱️ Prazo de defesa: *${opts.prazoDefesaDias} dias*` : "";
    const msg =
      `🚨 *Procedimento administrativo aberto*\n\n` +
      `${primeiroNome(u.nome)}, um procedimento apuratório foi registrado contra sua empresa:\n\n` +
      `Assunto: *${opts.assunto}*\n` +
      `Órgão: ${opts.orgao}${prazo}\n\n` +
      `Acesse pra apresentar defesa: https://cpsystem.app.br/procedimentos/${opts.procedimentoId}`;
    await dispararNotificacao({
      usuarioId: u.id,
      tipo: "PROCEDIMENTO_APURATORIO",
      referenciaId: `proc-${opts.procedimentoId}`,
      mensagem: msg,
    });
  }
}

// Novo parecer juridico gerado (via IA ou manual).
export async function notificarParecerJuridico(opts: {
  contaId: string;
  parecerId: string;
  titulo: string;
  documentoTipo: "ATA" | "CONTRATO" | "EMPENHO" | "GERAL";
}) {
  const usuarios = await destinatariosDaConta(opts.contaId);
  for (const u of usuarios) {
    const msg =
      `⚖️ *Novo parecer jurídico disponível*\n\n` +
      `${primeiroNome(u.nome)}, um parecer jurídico foi gerado:\n\n` +
      `*${opts.titulo}*\n` +
      `Categoria: ${opts.documentoTipo.toLowerCase()}\n\n` +
      `Confira no /juridico: https://cpsystem.app.br/juridico/${opts.parecerId}`;
    await dispararNotificacao({
      usuarioId: u.id,
      tipo: "PARECER_JURIDICO",
      referenciaId: `parecer-${opts.parecerId}`,
      mensagem: msg,
    });
  }
}

// Analista vinculou-se a uma empresa (ficou ATIVO).
export async function notificarAnalistaVinculado(opts: {
  contaId: string;
  vinculoId: string;
  nomeAnalista: string;
}) {
  const usuarios = await destinatariosDaConta(opts.contaId);
  for (const u of usuarios) {
    const msg =
      `🤝 *Analista vinculado à sua conta*\n\n` +
      `${primeiroNome(u.nome)}, o analista *${opts.nomeAnalista}* está agora vinculado como responsável pelos seus contratos públicos.\n\n` +
      `Gerencie o vínculo em: https://cpsystem.app.br/vinculos`;
    await dispararNotificacao({
      usuarioId: u.id,
      tipo: "ANALISTA_VINCULADO",
      referenciaId: `vinc-${opts.vinculoId}`,
      mensagem: msg,
    });
  }
}

// Reajuste aprovado (mês de vigência começa).
export async function notificarReajusteAprovado(opts: {
  contaId: string;
  reajusteId: string;
  empenhoNumero: string;
  orgao: string;
  percentual: number;
  mesInicio: string; // YYYY-MM
}) {
  const usuarios = await destinatariosDaConta(opts.contaId);
  const [ano, mes] = opts.mesInicio.split("-");
  const nomeMes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][Number(mes)-1];
  for (const u of usuarios) {
    const msg =
      `📈 *Reajuste aprovado*\n\n` +
      `${primeiroNome(u.nome)}, o empenho *${opts.empenhoNumero}* (${opts.orgao}) teve reajuste de *${opts.percentual.toFixed(2)}%* aprovado.\n\n` +
      `Vigência a partir de: ${nomeMes}/${ano}\n\n` +
      `Detalhes: https://cpsystem.app.br/reajustes/${opts.reajusteId}`;
    await dispararNotificacao({
      usuarioId: u.id,
      tipo: "REAJUSTE_APROVADO",
      referenciaId: `reaj-${opts.reajusteId}`,
      mensagem: msg,
    });
  }
}

// ==================== ANIVERSARIO ====================

// Envia mensagem de parabens pra usuarios com dataNascimento=hoje.
// Idempotente por ano — usa referenciaId = "aniv-YYYY".
export async function notificarAniversarios(hoje: Date = new Date()): Promise<{ enviados: number }> {
  const mes = hoje.getMonth() + 1;
  const dia = hoje.getDate();
  const ano = hoje.getFullYear();

  // Postgres — WHERE extract(month/day). Prisma nao suporta direto,
  // uso $queryRaw pra performance.
  const usuarios = await prisma.$queryRaw<Array<{ id: string; nome: string }>>`
    SELECT id, nome FROM "Usuario"
    WHERE "optInWhatsApp" = true
      AND "telefoneWhatsApp" IS NOT NULL
      AND EXTRACT(MONTH FROM "dataNascimento") = ${mes}
      AND EXTRACT(DAY FROM "dataNascimento") = ${dia}
  `;

  let enviados = 0;
  for (const u of usuarios) {
    const msg =
      `🎉 *Feliz aniversário, ${primeiroNome(u.nome)}!* 🎂\n\n` +
      `Toda a equipe do CP System te deseja um dia incrível e um ano cheio de contratos fechados, prazos cumpridos e pagamentos em dia.\n\n` +
      `Muito obrigado por confiar na gente pra cuidar da sua execução pública. Que venha muito sucesso!\n\n` +
      `Com carinho,\nEquipe CP System 💚`;
    const r = await dispararNotificacao({
      usuarioId: u.id,
      tipo: "ANIVERSARIO",
      referenciaId: `aniv-${ano}`,
      mensagem: msg,
    });
    if (r.enviado) enviados++;
  }
  return { enviados };
}

// ==================== ORQUESTRADOR DIARIO ====================

// Chamado pela regua diaria (que ja roda no cron da Vercel).
// Best-effort — falha em uma nao bloqueia as outras.
export async function executarNotificacoesDiarias(): Promise<{
  prazos: Awaited<ReturnType<typeof notificarPrazosConsolidado>>;
  planos: Awaited<ReturnType<typeof notificarVencimentosPlano>>;
  nfPendente: Awaited<ReturnType<typeof notificarNfSemPagamento30d>>;
  cartaoExpira: Awaited<ReturnType<typeof notificarCartaoExpirando>>;
  aniversario: Awaited<ReturnType<typeof notificarAniversarios>>;
}> {
  const hoje = new Date();
  const cadenciaVazia = Object.fromEntries(CADENCIA_DIAS.map((d) => [d, 0]));
  const prazos = await notificarPrazosConsolidado(hoje).catch((e) => {
    console.error("[notif] erro em prazos consolidado:", e);
    return { porDias: cadenciaVazia, hoje: 0, atrasado: 0 };
  });
  const planos = await notificarVencimentosPlano(hoje).catch((e) => {
    console.error("[notif] erro em vencimentos plano:", e);
    return { em3d: 0, atrasado: 0 };
  });
  const nfPendente = await notificarNfSemPagamento30d(hoje).catch((e) => {
    console.error("[notif] erro em NF sem pagamento:", e);
    return { enviados: 0 };
  });
  const cartaoExpira = await notificarCartaoExpirando(hoje).catch((e) => {
    console.error("[notif] erro em cartao expirando:", e);
    return { enviados: 0 };
  });
  const aniversario = await notificarAniversarios(hoje).catch((e) => {
    console.error("[notif] erro em aniversarios:", e);
    return { enviados: 0 };
  });
  return { prazos, planos, nfPendente, cartaoExpira, aniversario };
}
