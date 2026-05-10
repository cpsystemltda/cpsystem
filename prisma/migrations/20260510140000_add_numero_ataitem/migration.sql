-- AtaItem ganha campo "numero" — número do item dentro do lote
-- (ou global se item isolado). String pra aceitar "01", "1.A" etc.
ALTER TABLE "AtaItem" ADD COLUMN IF NOT EXISTS "numero" TEXT;
