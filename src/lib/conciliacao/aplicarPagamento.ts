import "server-only";
import { prisma } from "@/lib/prisma";

// Efeitos laterais quando uma conciliacao (transacao bancaria x empenho) e
// confirmada — automatica ou manualmente. Centraliza pra que auto-confirm
// e confirmacao humana produzam EXATAMENTE o mesmo efeito no banco.
//
// Regina 30/07: antes disso o auto-confirm so setava Empenho.status=PAGO e
// deixava data, comprovante e comissao do analista em branco. Isso quebrava
// o painel do analista (comissao ficava presa em AGUARDANDO_ORGAO) e sumia
// o comprovante do audit trail. Este helper resolve os 3 no mesmo momento.

export type AplicarPagamentoOpts = {
  empenhoId: string;
  transacaoId: string; // pra rastrear origem no comprovante e evitar dup
};

export type AplicarPagamentoResultado = {
  empenhoAtualizado: boolean;
  comissoesLiberadas: number;
  valorAplicado: number;
};

export async function aplicarPagamentoDeConciliacao(
  opts: AplicarPagamentoOpts,
): Promise<AplicarPagamentoResultado> {
  const [empenho, transacao] = await Promise.all([
    prisma.empenho.findUnique({ where: { id: opts.empenhoId } }),
    prisma.transacaoExtrato.findUnique({ where: { id: opts.transacaoId } }),
  ]);
  if (!empenho || !transacao) {
    return { empenhoAtualizado: false, comissoesLiberadas: 0, valorAplicado: 0 };
  }

  const [itens, comissoes, extrato] = await Promise.all([
    prisma.empenhoItem.findMany({
      where: { empenhoId: empenho.id },
      select: { valorTotal: true },
    }),
    prisma.comissaoExecucao.findMany({
      where: { empenhoId: empenho.id },
      select: { id: true, percentual: true, status: true, valorBasePago: true },
    }),
    prisma.extrato.findUnique({
      where: { id: transacao.extratoId },
      select: { id: true, urlArquivo: true, nomeArquivo: true },
    }),
  ]);
  if (!extrato) {
    return { empenhoAtualizado: false, comissoesLiberadas: 0, valorAplicado: 0 };
  }

  const valorEmpenho = itens.reduce((s, i) => s + i.valorTotal, 0);
  const valorPago = transacao.valor;

  // URL do comprovante: preferimos o link do PDF do extrato guardado em blob;
  // se nao houver (upload sem persistir), colocamos um placeholder-string com
  // referencia do extrato pra o app abrir o registro completo.
  const comprovante =
    extrato.urlArquivo ??
    `/conciliacao/extratos/${extrato.id}#tx-${transacao.id}`;

  // 1) Empenho — status/data/arquivo. NAO sobrescrevemos dataPagamento se ja
  // existir (respeita quem lançou manualmente antes).
  await prisma.empenho.update({
    where: { id: empenho.id },
    data: {
      status: "PAGO",
      dataPagamento: empenho.dataPagamento ?? transacao.data,
      arquivoPagamento: empenho.arquivoPagamento ?? comprovante,
    },
  });

  // 2) Comissoes de execucao vinculadas — libera pra o analista cobrar.
  //    - valorBasePago = valor efetivo pago pelo orgao (pode ser diferente
  //      do empenhado se houver glosa/parcial)
  //    - valorCalculado = valorBasePago * percentual / 100
  //    - status: AGUARDANDO_ORGAO -> A_RECEBER (analista agora pode cobrar
  //      a empresa)
  // Nao mexemos em comissoes ja PAGO/PAGO_PARCIAL/PAGO_AGUARDANDO_CONFIRMACAO
  // pra nao apagar historico de pagamento.
  let comissoesLiberadas = 0;
  for (const c of comissoes) {
    if (c.status !== "AGUARDANDO_ORGAO") continue;
    const valorCalculado = valorPago * (c.percentual / 100);
    await prisma.comissaoExecucao.update({
      where: { id: c.id },
      data: {
        valorBasePago: valorPago,
        valorCalculado,
        status: "A_RECEBER",
      },
    });
    comissoesLiberadas++;
  }

  return {
    empenhoAtualizado: true,
    comissoesLiberadas,
    valorAplicado: valorPago > 0 ? valorPago : valorEmpenho,
  };
}
