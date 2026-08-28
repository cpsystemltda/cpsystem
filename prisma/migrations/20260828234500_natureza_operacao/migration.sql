-- Natureza da operacao: campo obrigatorio da API fiscal que faltava no cadastro.
ALTER TABLE "ConfiguracaoFiscal" ADD COLUMN "naturezaOperacao" TEXT NOT NULL DEFAULT '1';
