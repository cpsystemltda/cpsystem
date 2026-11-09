-- Regina 09/11/2026: "Construtora Modelo deve ficar descrita como conta de teste, e não como cliente real".
ALTER TABLE "Conta" ADD COLUMN "contaTeste" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Conta" SET "contaTeste" = true
WHERE "id" IN (SELECT "contaId" FROM "Usuario" WHERE "email" = 'demonstracao@cpsystem.app.br');
