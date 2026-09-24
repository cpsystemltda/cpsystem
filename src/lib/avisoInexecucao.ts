import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Aviso de inexecução — o evento mais caro da execução de um contrato público.
 *
 * Demanda de cliente 23/09/2026, completada a pedido da Regina. Registrar a
 * inexecução na tela não basta: é fato que vira multa (art. 156 da Lei
 * 14.133), pode abrir procedimento apuratório e reaparece na habilitação da
 * próxima licitação. Quem cuida da carteira precisa saber no dia.
 *
 * Quem recebe, e por quê:
 * - **A empresa**, no sistema e no WhatsApp, porque é dela a consequência.
 * - **O analista vinculado**, porque a carteira é dele e a inexecução muda o
 *   risco da conta que ele acompanha (ver a regra de eventos críticos da
 *   carteira, combinada com a Regina).
 *
 * Nada aqui é obrigatório para o registro acontecer: o chamador trata isto
 * como best-effort, então uma falha de canal nunca derruba o lançamento que a
 * pessoa veio fazer.
 */
export async function avisarInexecucao(opts: {
  empenhoId: string;
  tipo: "INEXECUCAO_TOTAL" | "INEXECUCAO_PARCIAL";
  data: Date;
  motivo: string | null;
}): Promise<void> {
  const e = await prisma.empenho.findUnique({
    where: { id: opts.empenhoId },
    select: {
      id: true,
      numero: true,
      orgaoNome: true,
      empresaId: true,
      empresa: { select: { razaoSocial: true, contaId: true } },
    },
  });
  if (!e) return;

  const total = opts.tipo === "INEXECUCAO_TOTAL";
  const rotulo = total ? "Inexecução total" : "Inexecução parcial";
  const quando = opts.data.toLocaleDateString("pt-BR", { timeZone: "UTC" });

  const usuarios = await prisma.usuario.findMany({
    where: { contaId: e.empresa.contaId },
    select: { id: true, nome: true, optInWhatsApp: true, telefoneWhatsApp: true },
  });

  const { notificar } = await import("@/lib/notificacoes");
  const { dispararNotificacao } = await import("@/lib/whatsapp");

  for (const u of usuarios) {
    await notificar({
      usuarioId: u.id,
      tipo: "AVISO_CP_SYSTEM",
      titulo: `${rotulo} registrada — ${e.numero}`,
      descricao: total
        ? `${e.orgaoNome} · nada foi entregue em ${quando}. A esteira está travada: sem nota fiscal nem pagamento enquanto o registro existir.`
        : `${e.orgaoNome} · parte não será entregue (${quando}). O fornecimento segue marcado com inexecução parcial.`,
      link: `/execucao/${e.id}`,
      recursoTipo: "Empenho",
      recursoId: e.id,
    }).catch((err) => console.error("[inexecucao] aviso no sistema falhou:", err));

    if (u.optInWhatsApp && u.telefoneWhatsApp) {
      const primeiro = u.nome.split(" ")[0] || u.nome;
      await dispararNotificacao({
        usuarioId: u.id,
        tipo: "INEXECUCAO_REGISTRADA",
        // Uma por evento, não por empenho: um fornecimento pode ter inexecução
        // parcial em mais de uma data, e cada uma é um fato novo.
        referenciaId: `inexecucao-${e.id}-${opts.tipo}-${opts.data.toISOString().slice(0, 10)}`,
        mensagem:
          `${total ? "⛔" : "⚠️"} *${rotulo} registrada*\n\n` +
          `${primeiro}, foi lançada ${rotulo.toLowerCase()} no fornecimento *${e.numero}* ` +
          `(${e.orgaoNome}), com data de ${quando}.\n\n` +
          (opts.motivo ? `Motivo informado: ${opts.motivo}\n\n` : "") +
          (total
            ? `Enquanto esse registro existir, as etapas de nota fiscal, encaminhamento e pagamento ficam bloqueadas — não há o que faturar.\n\n` +
              `Vale reunir agora a documentação que justifica a inexecução: ela é o que a empresa vai apresentar se o órgão abrir procedimento.\n\n`
            : `O fornecimento segue normalmente para faturamento do que foi entregue, e fica marcado com a inexecução parcial.\n\n`) +
          `Ver no sistema: https://cpsystem.app.br/execucao/${e.id}`,
      }).catch((err) => console.error("[inexecucao] WhatsApp falhou:", err));
    }
  }

  // O analista que acompanha a carteira também precisa saber: é evento de
  // risco na conta dele, não só do cliente.
  try {
    const { notificarAnalistasDaEmpresa } = await import("@/lib/notificacoes");
    await notificarAnalistasDaEmpresa({
      empresaId: e.empresaId,
      tipo: "AVISO_CP_SYSTEM",
      titulo: `${rotulo} — ${e.empresa.razaoSocial}`,
      descricao: `Fornecimento ${e.numero} (${e.orgaoNome}) · ${quando}${opts.motivo ? ` · ${opts.motivo}` : ""}`,
      link: `/painel-analista`,
      recursoTipo: "Empenho",
      recursoId: e.id,
    });
  } catch (err) {
    console.error("[inexecucao] aviso ao analista falhou:", err);
  }
}
