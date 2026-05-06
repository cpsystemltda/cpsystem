-- Múltiplos e-mails e telefones por empresa (botão + no signup)
ALTER TABLE "Empresa" ADD COLUMN "emails" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Empresa" ADD COLUMN "telefonesLista" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: copia os valores legados (string única) pra primeiro item dos arrays
UPDATE "Empresa" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND "email" <> '';
UPDATE "Empresa" SET "telefonesLista" = ARRAY["telefones"] WHERE "telefones" IS NOT NULL AND "telefones" <> '';
