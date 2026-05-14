-- CreateEnum: modo de inclusão do prazo de entrega (relativo OU data certa)
CREATE TYPE "PrazoEntregaModo" AS ENUM ('RELATIVO', 'DATA_CERTA');

-- AlterTable Contrato: adiciona campos pra modo do prazo + marco de reajuste.
-- Defaults garantem retrocompat: contratos antigos ficam com modo RELATIVO,
-- sem data certa e sem marco de reajuste (NULL).
ALTER TABLE "Contrato"
  ADD COLUMN "prazoEntregaModo" "PrazoEntregaModo" NOT NULL DEFAULT 'RELATIVO',
  ADD COLUMN "dataEntregaCerta" TIMESTAMP(3),
  ADD COLUMN "marcoReajusteOrigem" "MarcoReajusteOrigem";
