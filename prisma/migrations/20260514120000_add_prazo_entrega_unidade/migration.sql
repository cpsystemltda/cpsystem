-- CreateEnum
CREATE TYPE "PrazoEntregaUnidade" AS ENUM ('DIAS', 'MESES');

-- AlterTable: registros pré-existentes ficam com default DIAS (eram todos
-- cadastrados em dias até esta feature).
ALTER TABLE "Ata"      ADD COLUMN "prazoEntregaUnidade" "PrazoEntregaUnidade" NOT NULL DEFAULT 'DIAS';
ALTER TABLE "Contrato" ADD COLUMN "prazoEntregaUnidade" "PrazoEntregaUnidade" NOT NULL DEFAULT 'DIAS';
ALTER TABLE "Empenho"  ADD COLUMN "prazoEntregaUnidade" "PrazoEntregaUnidade" NOT NULL DEFAULT 'DIAS';
