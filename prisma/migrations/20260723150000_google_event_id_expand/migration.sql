-- Google Calendar sync expandido pra Contratos, Atas, Garantias (Regina 23/07/2026).
ALTER TABLE "Ata" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Contrato" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Garantia" ADD COLUMN "googleEventId" TEXT;
