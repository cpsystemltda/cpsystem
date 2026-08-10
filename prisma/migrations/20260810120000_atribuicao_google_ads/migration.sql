-- Atribuicao de marketing: guarda de onde a conta veio (Google Ads e UTMs).
-- Todas as colunas sao nullable, entao a migration nao quebra linhas existentes.
ALTER TABLE "Conta" ADD COLUMN "gclid" TEXT;
ALTER TABLE "Conta" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "Conta" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "Conta" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "Conta" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "Conta" ADD COLUMN "conversaoEnviadaEm" TIMESTAMP(3);

-- Busca do exportador de conversoes offline: "contas com gclid ainda nao enviadas".
CREATE INDEX "Conta_gclid_conversaoEnviadaEm_idx" ON "Conta"("gclid", "conversaoEnviadaEm");
