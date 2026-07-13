-- Regina 13/07/2026: rastreio do PIX out automático pra analista.
-- Aditivo, sem impacto retroativo.
ALTER TABLE "Comissao" ADD COLUMN "transferenciaId" TEXT;
ALTER TABLE "Comissao" ADD COLUMN "ultimoErroPgto" TEXT;
