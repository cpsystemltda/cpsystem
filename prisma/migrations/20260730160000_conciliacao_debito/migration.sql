-- ConciliacaoDebito: extensao da conciliacao bancaria pra cobrir DEBITOS
-- (mensalidade CP System, fixo mensal analista, comissao variavel analista).
-- Regina 30/07.

CREATE TYPE "TipoContrapartidaDebito" AS ENUM (
  'COBRANCA_CP',
  'FIXO_ANALISTA',
  'COMISSAO_ANALISTA'
);

CREATE TABLE "ConciliacaoDebito" (
  "id" TEXT NOT NULL,
  "transacaoId" TEXT NOT NULL,
  "tipoContrapartida" "TipoContrapartidaDebito" NOT NULL,
  "contrapartidaId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "fatoresMatch" JSONB,
  "status" "StatusConciliacao" NOT NULL DEFAULT 'SUGERIDA',
  "confirmadaEm" TIMESTAMP(3),
  "confirmadaPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConciliacaoDebito_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConciliacaoDebito_transacaoId_idx" ON "ConciliacaoDebito"("transacaoId");
CREATE INDEX "ConciliacaoDebito_contrapartidaId_idx" ON "ConciliacaoDebito"("contrapartidaId");
CREATE INDEX "ConciliacaoDebito_tipoContrapartida_idx" ON "ConciliacaoDebito"("tipoContrapartida");

ALTER TABLE "ConciliacaoDebito"
  ADD CONSTRAINT "ConciliacaoDebito_transacaoId_fkey"
  FOREIGN KEY ("transacaoId") REFERENCES "TransacaoExtrato"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
