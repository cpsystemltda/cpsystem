-- Janela do modo PRAZO_CERTO no Empenho/Fornecimento/Execucao.
-- Ambas as colunas sao nullable — instantaneo no PostgreSQL.
ALTER TABLE "Empenho" ADD COLUMN "dataEntregaInicio" TIMESTAMP(3);
ALTER TABLE "Empenho" ADD COLUMN "dataEntregaFim" TIMESTAMP(3);
