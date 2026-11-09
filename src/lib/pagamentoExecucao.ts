import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificarMudancaStatus } from "@/lib/notificacoesWhatsapp";
import { sincronizarComissoesComEmpenhoPago } from "@/lib/comissaoExecucao";
import { notificarAnalistasDaEmpresa } from "@/lib/notificacoes";

/**
 * Baixa de pagamento de uma execução vinda de fora da tela (API pública).
 * Faz exatamente o que o botão "Pago" da tela faz depois de gravar —
 * notificação, comissões do analista e aviso aos analistas — para a API
 * não abrir um segundo caminho de dinheiro com regras diferentes.
 */
export async function registrarPagamentoExecucao(opts: { contaId: string; empenhoId: string; data: Date; origem: string; usuarioId?: string | null; observacao?: string | null }): Promise<{ ok: true; jaEstavaPago: boolean } | { ok: false; erro: string; status: number }> {
  const empenho = await prisma.empenho.findFirst({
    where: { id: opts.empenhoId, empresa: { contaId: opts.contaId } },
    include: { itens: { select: { valorTotal: true } } },
  });
  if (!empenho) return { ok: false, erro: "Execução não encontrada.", status: 404 };
  if (empenho.status === "PAGO") return { ok: true, jaEstavaPago: true };
  if (opts.data.getTime() > Date.now() + 86_400_000) return { ok: false, erro: "A data de pagamento está no futuro.", status: 422 };

  await prisma.empenho.update({ where: { id: empenho.id }, data: { status: "PAGO", dataPagamento: opts.data } });
  const valorTotal = empenho.itens.reduce((s, i) => s + i.valorTotal, 0);
  await registrarAuditoria({
    contaId: opts.contaId,
    usuarioId: opts.usuarioId ?? null,
    acao: "ATUALIZAR",
    recurso: "Empenho",
    recursoId: empenho.id,
    resumo: `Pagamento registrado via ${opts.origem} em ${opts.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}${opts.observacao ? ` · ${opts.observacao}` : ""}`,
  });
  await notificarMudancaStatus({
    contaId: opts.contaId,
    empenhoId: empenho.id,
    numeroEmpenho: empenho.numero,
    instrumento: empenho.instrumento,
    orgao: empenho.orgaoNome,
    novoStatus: "PAGO",
  }).catch((e) => console.error("[pagamento api] notif", e));
  await sincronizarComissoesComEmpenhoPago({ empenhoId: empenho.id, valorBasePago: valorTotal });
  await notificarAnalistasDaEmpresa({
    empresaId: empenho.empresaId,
    tipo: "STATUS_PAGO",
    titulo: `Empenho ${empenho.numero} pago pelo órgão`,
    descricao: `${empenho.orgaoNome} · R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · sua comissão está disponível para cobrança`,
    link: `/painel-analista`,
    recursoTipo: "Empenho",
    recursoId: empenho.id,
  }).catch((e) => console.error("[pagamento api] analistas", e));
  return { ok: true, jaEstavaPago: false };
}
