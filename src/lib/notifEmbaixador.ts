import "server-only";
import { prisma } from "@/lib/prisma";

// Notifica o EMBAIXADOR (analista que indicou o cliente) via WhatsApp
// quando algo importante rola com o cliente vinculado.
// Regina 19/07: Igor pediu pra receber msgs importantes sobre o Léo — mesmo
// padrão de mensagens que o Léo recebe. Chamar em pontos-chave do pipeline:
// pagamento aprovado, NF emitida, contrato vencendo, empenho vencendo, etc.

export type EventoEmbaixador =
  | { tipo: "PAGAMENTO_RECEBIDO"; valor: number; competencia: string }
  | { tipo: "NF_EMITIDA"; numero: string; competencia: string }
  | { tipo: "INADIMPLENTE"; competencia: string; valor: number }
  | { tipo: "CONTRATO_VENCENDO"; numero: string; venceEm: Date }
  | { tipo: "EMPENHO_VENCENDO"; numero: string; venceEm: Date }
  | { tipo: "CUSTOM"; titulo: string; corpo: string };

export async function notificarEmbaixadorSobreCliente(opts: {
  contaClienteId: string;
  evento: EventoEmbaixador;
}): Promise<{ enviado: boolean; motivo?: string; messageId?: string }> {
  const conta = await prisma.conta.findUnique({
    where: { id: opts.contaClienteId },
    select: {
      embaixadorId: true,
      empresas: { select: { razaoSocial: true }, take: 1, orderBy: { criadoEm: "asc" } },
    },
  });
  if (!conta?.embaixadorId) return { enviado: false, motivo: "sem_embaixador" };

  const analista = await prisma.analista.findUnique({
    where: { id: conta.embaixadorId },
    select: { nomeCompleto: true, contaId: true },
  });
  if (!analista?.contaId) return { enviado: false, motivo: "analista_sem_conta" };

  // Busca super admin da conta ANALISTA + também o super admin CP System
  // vinculado (caso Igor: mesma pessoa em 2 contas). Regina 19/07: sempre
  // usar o usuário com telefone + opt-in true.
  const usuarios = await prisma.usuario.findMany({
    where: {
      OR: [
        { contaId: analista.contaId },
        // Se o embaixador for Igor superadmin (email igor@contratospublicos.com.br),
        // notifica também a conta CP System super admin (que é onde o WA está).
        { email: { contains: analista.nomeCompleto.split(" ")[0].toLowerCase(), mode: "insensitive" }, superAdmin: true },
      ],
      optInWhatsApp: true,
      telefoneWhatsApp: { not: null },
    },
    select: { id: true, nome: true, telefoneWhatsApp: true },
  });
  if (usuarios.length === 0) return { enviado: false, motivo: "sem_wa_optin" };

  const nomeCliente = conta.empresas[0]?.razaoSocial ?? "cliente";
  const msg = montarMensagem(nomeCliente, opts.evento);

  const { dispararNotificacao } = await import("@/lib/whatsapp");
  let ultimoResult: { enviado: boolean; motivo?: string; messageId?: string } = { enviado: false, motivo: "nada_enviado" };
  for (const u of usuarios) {
    const r = await dispararNotificacao({
      usuarioId: u.id,
      tipo: mapTipo(opts.evento.tipo),
      referenciaId: `emb-${opts.contaClienteId}-${opts.evento.tipo}-${(("competencia" in opts.evento && opts.evento.competencia) || ("numero" in opts.evento && opts.evento.numero) || "adhoc")}`,
      mensagem: msg,
    }).catch((e) => ({ enviado: false, motivo: `erro:${e instanceof Error ? e.message : String(e)}` }));
    ultimoResult = r;
  }
  return ultimoResult;
}

function mapTipo(t: EventoEmbaixador["tipo"]) {
  // Reusa enums existentes de TipoNotificacaoWhatsApp
  switch (t) {
    case "PAGAMENTO_RECEBIDO":
    case "NF_EMITIDA":
      return "COMISSAO_LIBERADA" as const;
    case "INADIMPLENTE":
      return "PLANO_ATRASADO" as const;
    case "CONTRATO_VENCENDO":
    case "EMPENHO_VENCENDO":
      return "VENCIMENTO_EMPENHO" as const;
    default:
      return "ANALISTA_VINCULADO" as const;
  }
}

function montarMensagem(nomeCliente: string, ev: EventoEmbaixador): string {
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dt = (d: Date) => d.toLocaleDateString("pt-BR");
  switch (ev.tipo) {
    case "PAGAMENTO_RECEBIDO":
      return (
        `💰 *Pagamento confirmado — cliente vinculado a você*\n\n` +
        `*${nomeCliente}* pagou a mensalidade de ${ev.competencia} (${brl(ev.valor)}).\n\n` +
        `Sua comissão por esse cliente continua correndo. O próximo PIX de comissão sai no dia 20 do mês seguinte.\n\n` +
        `Acompanhe em cpsystem.app.br/painel-analista`
      );
    case "NF_EMITIDA":
      return (
        `📄 *Nota Fiscal emitida — cliente vinculado a você*\n\n` +
        `A NF *${ev.numero}* referente à mensalidade *${ev.competencia}* do cliente *${nomeCliente}* foi emitida com sucesso.\n\n` +
        `Ciclo mensal completo — comissão referente a este mês entra no seu próximo PIX.`
      );
    case "INADIMPLENTE":
      return (
        `⚠️ *Cliente em atraso — atenção*\n\n` +
        `O cliente *${nomeCliente}* está com a mensalidade *${ev.competencia}* (${brl(ev.valor)}) em atraso.\n\n` +
        `Enquanto o pagamento não for regularizado, sua comissão referente a esse cliente também fica suspensa. Vale entrar em contato com ele.`
      );
    case "CONTRATO_VENCENDO":
      return (
        `⚠️ *Contrato do seu cliente vencendo*\n\n` +
        `Cliente: *${nomeCliente}*\n` +
        `Contrato *${ev.numero}* vence em *${dt(ev.venceEm)}*.\n\n` +
        `Se houver interesse em prorrogar, vale alinhar com o cliente pra não perder o prazo.`
      );
    case "EMPENHO_VENCENDO":
      return (
        `⚠️ *Empenho do seu cliente vencendo*\n\n` +
        `Cliente: *${nomeCliente}*\n` +
        `Empenho *${ev.numero}* vence em *${dt(ev.venceEm)}*.\n\n` +
        `Recomendável verificar entrega/execução com o cliente.`
      );
    case "CUSTOM":
      return `${ev.titulo}\n\n${ev.corpo}`;
  }
}
