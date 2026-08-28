import "server-only";
import { prisma } from "@/lib/prisma";
import { blocoParaContabilidade } from "@/lib/blocoNota";

/**
 * "Hora de solicitar a nota" — o aviso que dispara quando a entrega é registrada.
 *
 * Regina 28/08, ao decidir controle de notas em vez de emissão: o CP System
 * nunca toca no documento fiscal, mas cuida de tudo em volta — que é onde o
 * dinheiro do cliente se perde de verdade.
 *
 * A entrega é o gatilho certo porque é dela que nasce o direito de faturar, e é
 * o momento em que a nota costuma ser esquecida: o cliente entregou, respirou,
 * e só lembra da nota quando o pagamento não chega.
 *
 * A mensagem leva TODOS os dados prontos para copiar e mandar ao contador —
 * órgão, CNPJ, empenho, itens e valor. Sem isso, o aviso vira mais uma cobrança
 * sem instrução, e a pessoa ainda precisa voltar ao sistema para juntar tudo.
 */

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Avisa o cliente que chegou a hora de pedir a nota. Best-effort: falha aqui
 * nunca pode derrubar o registro da entrega, que é o que o usuário pediu.
 */
export async function avisarParaSolicitarNota(empenhoId: string): Promise<void> {
  const e = await prisma.empenho.findUnique({
    where: { id: empenhoId },
    select: {
      id: true,
      numero: true,
      orgaoNome: true,
      orgaoCnpj: true,
      processoAdministrativo: true,
      dataEntrega: true,
      dataNfEmitida: true,
      itens: { select: { descricao: true, quantidade: true, unidade: true, valorTotal: true } },
      empresa: { select: { razaoSocial: true, cnpj: true, contaId: true } },
    },
  });
  if (!e || e.dataNfEmitida) return; // nota já registrada: nada a pedir

  const total = e.itens.reduce((s, i) => s + i.valorTotal, 0);
  const bloco = blocoParaContabilidade({
    numero: e.numero,
    orgaoNome: e.orgaoNome,
    orgaoCnpj: e.orgaoCnpj,
    processoAdministrativo: e.processoAdministrativo,
    empresaRazaoSocial: e.empresa.razaoSocial,
    empresaCnpj: e.empresa.cnpj,
    dataEntrega: e.dataEntrega,
    itens: e.itens,
  });

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
      titulo: `Hora de solicitar a nota — empenho ${e.numero}`,
      descricao:
        `Entrega registrada para ${e.orgaoNome}. ${brl(total)} a faturar. ` +
        `Abra o empenho para copiar os dados prontos para a contabilidade.`,
      link: `/execucao/${e.id}`,
      recursoTipo: "Empenho",
      recursoId: e.id,
    }).catch((err) => console.error("[solicitar-nota] aviso no sistema falhou:", err));

    if (u.optInWhatsApp && u.telefoneWhatsApp) {
      const primeiro = u.nome.split(" ")[0] || u.nome;
      await dispararNotificacao({
        usuarioId: u.id,
        tipo: "SOLICITAR_NOTA",
        referenciaId: `solicitar-nota-${e.id}`,
        mensagem:
          `🧾 *Hora de solicitar a nota fiscal*\n\n` +
          `${primeiro}, a entrega do empenho *${e.numero}* (${e.orgaoNome}) está registrada — ` +
          `é o momento de pedir a nota à contabilidade.\n\n` +
          `Segue o que ela precisa, é só encaminhar:\n\n` +
          `${bloco}\n\n` +
          `Quando a nota sair, anexe no empenho que o sistema lê os dados e passa a contar o ` +
          `prazo de pagamento do órgão: https://cpsystem.app.br/execucao/${e.id}`,
      }).catch((err) => console.error("[solicitar-nota] WhatsApp falhou:", err));
    }
  }
}
