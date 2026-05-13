-- CreateEnum
CREATE TYPE "InstrumentoContratual" AS ENUM ('NOTA_EMPENHO', 'CARTA_CONTRATO', 'AUTORIZACAO_COMPRA', 'AUTORIZACAO_ENTREGA', 'ORDEM_SERVICO');

-- AlterTable: adiciona instrumento + campos específicos por instrumento.
-- Empenhos legados ganham default NOTA_EMPENHO (sem regressão visual).
ALTER TABLE "Empenho"
  ADD COLUMN "instrumento" "InstrumentoContratual" NOT NULL DEFAULT 'NOTA_EMPENHO',
  ADD COLUMN "classificacaoOrcamentaria" TEXT,
  ADD COLUMN "signatario" TEXT,
  ADD COLUMN "dataAssinatura" TIMESTAMP(3),
  ADD COLUMN "departamentoEmissor" TEXT,
  ADD COLUMN "pontoColeta" TEXT,
  ADD COLUMN "contatoRecebedor" TEXT,
  ADD COLUMN "fiscalResponsavel" TEXT;
