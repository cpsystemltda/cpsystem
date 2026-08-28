import "server-only";
import { prisma } from "@/lib/prisma";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Detecta e avisa quando a IA para de funcionar — antes de o cliente perceber.
 *
 * Regina 28/08, depois de a API do Claude ficar sem crédito e derrubar leitura
 * de PDF, atendimento no WhatsApp, jurídico e conciliação: "não deixe nada
 * parar".
 *
 * Não dá pra impedir que o fornecedor caia. Dá pra impedir que a queda seja
 * SILENCIOSA: sem isto, a gente descobria por reclamação de cliente. O aviso
 * distingue falta de crédito de erro técnico, porque a ação é diferente —
 * crédito se resolve em dois minutos no painel de cobrança.
 */

const TITULO_AVISO = "IA indisponível";
const INTERVALO_MS = 60 * 60 * 1000; // no máximo 1 aviso por hora

export function ehFalhaDeCredito(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("credit balance") ||
    msg.includes("credit_balance") ||
    msg.includes("insufficient") ||
    msg.includes("billing") ||
    msg.includes("quota")
  );
}

/** Mensagem curta e sem jargão pra mostrar ao cliente quando a IA não responde. */
export function mensagemParaCliente(): string {
  return (
    "A leitura automática está indisponível neste momento. " +
    "Você pode preencher os dados manualmente — nada se perde, e avisamos assim que voltar."
  );
}

/**
 * Avisa a equipe, no máximo uma vez por hora. O limite existe porque uma queda
 * de fornecedor gera dezenas de erros por minuto: sem ele, o alerta viraria
 * enxurrada e ninguém leria nenhum.
 */
export async function avisarFalhaDeIa(contexto: string, err: unknown): Promise<void> {
  const credito = ehFalhaDeCredito(err);
  const desde = new Date(Date.now() - INTERVALO_MS);

  try {
    // A trava de repetição vive na conta interna do CP System: é registro
    // técnico nosso, não movimentação de cliente.
    const contaInterna = await prisma.conta.findFirst({
      where: { usuarios: { some: { superAdmin: true } } },
      select: { id: true },
    });
    if (!contaInterna) return;

    const jaAvisado = await prisma.logAuditoria.findFirst({
      where: { recurso: "IA", resumo: { startsWith: TITULO_AVISO }, criadoEm: { gte: desde } },
      select: { id: true },
    });
    if (jaAvisado) return;

    const detalhe = err instanceof Error ? err.message.slice(0, 180) : String(err).slice(0, 180);

    await prisma.logAuditoria.create({
      data: {
        contaId: contaInterna.id,
        acao: "ATUALIZAR",
        recurso: "IA",
        resumo: `${TITULO_AVISO} — ${contexto}: ${detalhe}`,
      },
    });

    await avisarEquipe(
      credito
        ? `🔴 *IA parada — sem crédito na API*\n\n` +
            `Onde falhou: ${contexto}\n\n` +
            `Enquanto isso param: leitura de PDF, atendimento automático no WhatsApp, ` +
            `consultoria jurídica e conciliação bancária. O cliente recebe aviso de que a ` +
            `leitura está indisponível e segue podendo preencher à mão.\n\n` +
            `Resolve em: console.anthropic.com/settings/billing → Add credits. ` +
            `Vale ligar o Auto-reload pra não repetir.`
        : `⚠️ *IA falhou*\n\n` +
            `Onde: ${contexto}\n` +
            `Erro: ${detalhe}\n\n` +
            `O cliente foi avisado e o atendimento seguiu por gente.`,
    );
  } catch (e) {
    console.error("[falha-ia] não consegui avisar a equipe:", e);
  }
}
