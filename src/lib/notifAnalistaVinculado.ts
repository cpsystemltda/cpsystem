import "server-only";
import { prisma } from "@/lib/prisma";

// Notifica o ANALISTA de um vínculo (não confundir com embaixador que indicou
// a conta). Usado no fluxo comissão-por-execução: quando a empresa marca uma
// comissão como paga, o analista recebe WA e precisa confirmar recebimento
// no painel dele.

export type EventoAnalistaVinculado =
  | {
      tipo: "COMISSAO_MARCADA_PAGA_EMPRESA";
      nomeEmpresa: string;
      empenhoRef: string;
      valor: number;
      observacao?: string | null;
      linkConfirmacao: string;
    };

export async function notificarAnalistaVinculadoSobre(opts: {
  analistaId: string;
  evento: EventoAnalistaVinculado;
}): Promise<{ enviado: boolean; motivo?: string; messageId?: string }> {
  const analista = await prisma.analista.findUnique({
    where: { id: opts.analistaId },
    select: { contaId: true, nomeCompleto: true },
  });
  if (!analista?.contaId) return { enviado: false, motivo: "analista_sem_conta" };

  const primeiroNome = analista.nomeCompleto.split(" ")[0]?.toLowerCase() ?? "";
  const usuarios = await prisma.usuario.findMany({
    where: {
      OR: [
        { contaId: analista.contaId },
        primeiroNome
          ? { email: { contains: primeiroNome, mode: "insensitive" }, superAdmin: true }
          : { id: "" },
      ],
      optInWhatsApp: true,
      telefoneWhatsApp: { not: null },
    },
    select: { id: true, nome: true, telefoneWhatsApp: true },
  });
  if (usuarios.length === 0) return { enviado: false, motivo: "sem_wa_optin" };

  const msg = montarMensagem(opts.evento);
  const { dispararNotificacao } = await import("@/lib/whatsapp");
  let ultimo: { enviado: boolean; motivo?: string; messageId?: string } = {
    enviado: false,
    motivo: "nada_enviado",
  };
  for (const u of usuarios) {
    const r = await dispararNotificacao({
      usuarioId: u.id,
      tipo: "COMISSAO_LIBERADA",
      referenciaId: `anav-${opts.analistaId}-${opts.evento.tipo}-${opts.evento.empenhoRef}`,
      mensagem: msg,
    }).catch((e) => ({
      enviado: false,
      motivo: `erro:${e instanceof Error ? e.message : String(e)}`,
    }));
    ultimo = r;
  }
  return ultimo;
}

function montarMensagem(ev: EventoAnalistaVinculado): string {
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  switch (ev.tipo) {
    case "COMISSAO_MARCADA_PAGA_EMPRESA":
      return (
        `💰 *Empresa marcou uma comissão como paga — CP System*\n\n` +
        `A empresa *${ev.nomeEmpresa}* declarou pagamento da comissão do empenho *${ev.empenhoRef}* no valor de ${brl(ev.valor)}.\n\n` +
        (ev.observacao ? `Observação da empresa: ${ev.observacao}\n\n` : ``) +
        `*Ação necessária:*\n` +
        `Confirme o recebimento no seu painel pra a comissão virar "Pago" definitivo. Enquanto não confirmar, ela fica registrada como "Aguardando confirmação".\n\n` +
        `Painel: ${ev.linkConfirmacao}`
      );
  }
}
