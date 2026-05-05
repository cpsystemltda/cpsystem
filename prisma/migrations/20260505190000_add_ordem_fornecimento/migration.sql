-- Adicionar campos de Ordem de Fornecimento ao Contrato e Empenho.
ALTER TABLE "Contrato"
  ADD COLUMN "numeroOrdemFornecimento" TEXT,
  ADD COLUMN "arquivoOfUrl" TEXT;

ALTER TABLE "Empenho"
  ADD COLUMN "numeroOrdemFornecimento" TEXT,
  ADD COLUMN "arquivoOfUrl" TEXT;
