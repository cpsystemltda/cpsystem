-- Programa de Referral C2C (cliente indica cliente).
-- Adiciona Conta.indicadoPorContaId — self-reference opcional.
-- Quando uma conta indicada paga 1a Cobranca, a conta que indicou ganha
-- 1 mes gratis no proximo ciclo.

ALTER TABLE "Conta" ADD COLUMN "indicadoPorContaId" TEXT;

ALTER TABLE "Conta" ADD CONSTRAINT "Conta_indicadoPorContaId_fkey"
  FOREIGN KEY ("indicadoPorContaId") REFERENCES "Conta"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Conta_indicadoPorContaId_idx" ON "Conta"("indicadoPorContaId");
