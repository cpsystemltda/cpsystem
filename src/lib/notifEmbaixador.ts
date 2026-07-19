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
  // Tom: analista/consultor gerenciando portfolio — visão de gestão, não
  // "cópia da msg do cliente". Foco em: (1) o que mudou no cliente,
  // (2) impacto na sua carteira, (3) ação recomendada como analista.
  switch (ev.tipo) {
    case "PAGAMENTO_RECEBIDO":
      return (
        `📊 *Atualização de carteira — CP System*\n\n` +
        `Seu cliente *${nomeCliente}* teve a mensalidade de ${ev.competencia} liquidada (${brl(ev.valor)}). Assinatura ativa confirmada.\n\n` +
        `*Impacto na sua carteira:*\n` +
        `• Cliente segue elegível pra comissão vitalícia enquanto permanecer ativo\n` +
        `• Sua comissão referente a este mês é apurada no fechamento e paga via PIX no dia 20 do mês seguinte\n\n` +
        `Detalhes do portfólio: cpsystem.app.br/painel-analista`
      );
    case "NF_EMITIDA":
      return (
        `📊 *Fechamento fiscal do mês — cliente da sua carteira*\n\n` +
        `A NF ${ev.numero} do cliente *${nomeCliente}* foi autorizada pela prefeitura (competência ${ev.competencia}).\n\n` +
        `*O que isso significa pra você como analista:*\n` +
        `• Ciclo mensal do cliente encerrado com sucesso\n` +
        `• Comissão apurada e liberada pra pagamento no próximo dia 20\n` +
        `• Cliente segue com pipeline financeiro em dia — sem risco imediato de churn\n\n` +
        `Painel: cpsystem.app.br/painel-analista`
      );
    case "INADIMPLENTE":
      return (
        `🚨 *Alerta de risco na carteira — CP System*\n\n` +
        `Seu cliente *${nomeCliente}* ficou inadimplente (mensalidade ${ev.competencia}, ${brl(ev.valor)}).\n\n` +
        `*Ação recomendada como analista:*\n` +
        `• Entrar em contato com o cliente hoje pra entender a causa (esquecimento, restrição no cartão, disputa)\n` +
        `• Reforçar o valor entregue pra evitar churn\n` +
        `• A comissão referente a este cliente fica suspensa até regularização\n\n` +
        `Se precisar de suporte da equipe CP System, chama aqui.`
      );
    case "CONTRATO_VENCENDO":
      return (
        `📋 *Movimento na operação do cliente — atenção do analista*\n\n` +
        `Cliente: *${nomeCliente}*\n` +
        `Contrato *${ev.numero}* vence em *${dt(ev.venceEm)}*.\n\n` +
        `*Ação recomendada como analista:*\n` +
        `• Verificar interesse em prorrogação com o cliente\n` +
        `• Se o órgão for tocar aditivo, alinhar a documentação\n` +
        `• Se for encerrar, checar entregas pendentes e saldos\n\n` +
        `Painel do cliente: cpsystem.app.br/painel-analista`
      );
    case "EMPENHO_VENCENDO":
      return (
        `📋 *Movimento na operação do cliente — atenção do analista*\n\n` +
        `Cliente: *${nomeCliente}*\n` +
        `Empenho *${ev.numero}* vence em *${dt(ev.venceEm)}*.\n\n` +
        `*Ação recomendada como analista:*\n` +
        `• Confirmar com o cliente se a execução/entrega está no prazo\n` +
        `• Verificar saldo não executado — pode virar prejuízo se prescrever\n` +
        `• Se necessário, orientar o cliente a solicitar prorrogação ao órgão\n\n` +
        `Painel: cpsystem.app.br/painel-analista`
      );
    case "CUSTOM":
      return `${ev.titulo}\n\n${ev.corpo}`;
  }
}
