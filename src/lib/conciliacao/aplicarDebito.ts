import "server-only";
import { prisma } from "@/lib/prisma";
import type { TipoContrapartidaDebito } from "@/generated/prisma/client";

// Efeitos laterais quando uma ConciliacaoDebito e confirmada — muda o
// registro da contrapartida (Cobranca / PagamentoFixoMensal / ComissaoExecucao)
// pra refletir o pagamento visto no extrato.

export type AplicarDebitoOpts = {
  tipoContrapartida: TipoContrapartidaDebito;
  contrapartidaId: string;
  transacaoId: string;
};

export type AplicarDebitoResultado = { atualizado: boolean; motivo?: string };

export async function aplicarDebitoDeConciliacao(
  opts: AplicarDebitoOpts,
): Promise<AplicarDebitoResultado> {
  const transacao = await prisma.transacaoExtrato.findUnique({
    where: { id: opts.transacaoId },
    select: {
      id: true,
      data: true,
      valor: true,
      extrato: { select: { id: true, urlArquivo: true } },
    },
  });
  if (!transacao) return { atualizado: false, motivo: "transacao_nao_encontrada" };

  const comprovante =
    transacao.extrato.urlArquivo ??
    `/conciliacao/extratos/${transacao.extrato.id}#tx-${transacao.id}`;

  switch (opts.tipoContrapartida) {
    case "COBRANCA_CP": {
      const cob = await prisma.cobranca.findUnique({ where: { id: opts.contrapartidaId } });
      if (!cob) return { atualizado: false, motivo: "cobranca_nao_encontrada" };
      if (cob.status === "PAGA") return { atualizado: true };
      await prisma.cobranca.update({
        where: { id: cob.id },
        data: {
          status: "PAGA",
          pagaEm: cob.pagaEm ?? transacao.data,
        },
      });
      return { atualizado: true };
    }
    case "FIXO_ANALISTA": {
      const fixo = await prisma.pagamentoFixoMensal.findUnique({
        where: { id: opts.contrapartidaId },
      });
      if (!fixo) return { atualizado: false, motivo: "fixo_nao_encontrado" };
      if (fixo.status === "PAGO") return { atualizado: true };
      await prisma.pagamentoFixoMensal.update({
        where: { id: fixo.id },
        data: {
          status: "PAGO",
          valorRecebido: transacao.valor,
          paga: true,
          pagaEm: fixo.pagaEm ?? transacao.data,
          comprovanteUrl: fixo.comprovanteUrl ?? comprovante,
        },
      });
      return { atualizado: true };
    }
    case "COMISSAO_ANALISTA": {
      const com = await prisma.comissaoExecucao.findUnique({
        where: { id: opts.contrapartidaId },
      });
      if (!com) return { atualizado: false, motivo: "comissao_nao_encontrada" };
      if (com.status === "PAGO") return { atualizado: true };
      // Determina PAGO ou PAGO_PARCIAL baseado no valor
      const somaRecebido = com.valorRecebido + transacao.valor;
      const cobreTudo = somaRecebido >= com.valorCalculado - 0.01;
      await prisma.comissaoExecucao.update({
        where: { id: com.id },
        data: {
          status: cobreTudo ? "PAGO" : "PAGO_PARCIAL",
          valorRecebido: somaRecebido,
          dataPagamento: com.dataPagamento ?? transacao.data,
          comprovanteUrl: com.comprovanteUrl ?? comprovante,
        },
      });
      return { atualizado: true };
    }
  }
}
