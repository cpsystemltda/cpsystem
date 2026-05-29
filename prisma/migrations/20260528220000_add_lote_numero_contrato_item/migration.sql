-- Add Lote e Numero ao ContratoItem (paridade com AtaItem).
-- Ambas as colunas sao nullable, sem default — operacao instantanea
-- no PostgreSQL (sem rewrite da tabela), segura em prod.
ALTER TABLE "ContratoItem" ADD COLUMN "lote" TEXT;
ALTER TABLE "ContratoItem" ADD COLUMN "numero" TEXT;
