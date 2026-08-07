-- Preferencias de sincronizacao do Google Calendar (Leo 30/07, via Regina 07/08).
-- Aditiva e com DEFAULT true: quem ja esta conectado continua recebendo tudo
-- exatamente como antes, sem quebra de comportamento.
ALTER TABLE "GoogleAccount" ADD COLUMN "syncEmpenhos"  BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GoogleAccount" ADD COLUMN "syncAtas"      BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GoogleAccount" ADD COLUMN "syncContratos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GoogleAccount" ADD COLUMN "syncGarantias" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GoogleAccount" ADD COLUMN "syncCobrancas" BOOLEAN NOT NULL DEFAULT true;
