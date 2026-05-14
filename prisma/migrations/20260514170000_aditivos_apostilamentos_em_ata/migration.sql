-- AlterTable: TermoAditivo e Apostilamento agora podem ser vinculados à
-- Ata (além de Contrato e Empenho). M3 Painel de Atas ampliação 3.
ALTER TABLE "TermoAditivo" ADD COLUMN "ataId" TEXT;
ALTER TABLE "Apostilamento" ADD COLUMN "ataId" TEXT;

-- Index pra consulta por Ata
CREATE INDEX "TermoAditivo_ataId_idx" ON "TermoAditivo"("ataId");
CREATE INDEX "Apostilamento_ataId_idx" ON "Apostilamento"("ataId");

-- FK com cascade igual aos outros vínculos
ALTER TABLE "TermoAditivo"
  ADD CONSTRAINT "TermoAditivo_ataId_fkey"
  FOREIGN KEY ("ataId") REFERENCES "Ata"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Apostilamento"
  ADD CONSTRAINT "Apostilamento_ataId_fkey"
  FOREIGN KEY ("ataId") REFERENCES "Ata"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
