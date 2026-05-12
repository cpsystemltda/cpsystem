-- Rastreio do criador de cada documento — base da regra de permissão
-- "só edita quem é criador OU ADMIN/superAdmin da conta".
-- Nullable: registros legados (anteriores à feature) ficam sem criador
-- e, por convenção, são editáveis só por ADMIN da empresa.

ALTER TABLE "Ata"      ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;
ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;
ALTER TABLE "Empenho"  ADD COLUMN IF NOT EXISTS "criadoPorId" TEXT;

-- FK opcional com ON DELETE SET NULL: se o usuário criador for removido,
-- o documento permanece (perde o vínculo de "criador" mas continua válido).
ALTER TABLE "Ata"
  ADD CONSTRAINT "Ata_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contrato"
  ADD CONSTRAINT "Contrato_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Empenho"
  ADD CONSTRAINT "Empenho_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Ata_criadoPorId_idx"      ON "Ata"("criadoPorId");
CREATE INDEX IF NOT EXISTS "Contrato_criadoPorId_idx" ON "Contrato"("criadoPorId");
CREATE INDEX IF NOT EXISTS "Empenho_criadoPorId_idx"  ON "Empenho"("criadoPorId");
