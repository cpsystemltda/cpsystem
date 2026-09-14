-- Atestado de Capacidade Tecnica: acompanhamento do pedido ao orgao.
--
-- Encerrada a vigencia, o sistema passa a cobrar o atestado. Estas colunas
-- existem pra essa cobranca saber a hora de parar: solicitadoEm (pedido feito,
-- aguardando o orgao) e dispensadoEm (o cliente decidiu que nao vai pedir).
--
-- Aditiva e toda anulavel: nenhuma linha existente muda de comportamento --
-- com os dois campos NULL, a Ata/Contrato encerrado simplesmente entra na
-- fila de cobranca, que e exatamente o que se quer.
ALTER TABLE "Ata"
  ADD COLUMN "atestadoSolicitadoEm"   TIMESTAMP(3),
  ADD COLUMN "atestadoDispensadoEm"   TIMESTAMP(3),
  ADD COLUMN "atestadoDispensaMotivo" TEXT;

ALTER TABLE "Contrato"
  ADD COLUMN "atestadoSolicitadoEm"   TIMESTAMP(3),
  ADD COLUMN "atestadoDispensadoEm"   TIMESTAMP(3),
  ADD COLUMN "atestadoDispensaMotivo" TEXT;
