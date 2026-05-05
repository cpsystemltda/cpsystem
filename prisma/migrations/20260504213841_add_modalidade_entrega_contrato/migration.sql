-- CreateEnum
CREATE TYPE "ModalidadeEntrega" AS ENUM ('INTEGRAL', 'PARCELADA', 'SOB_DEMANDA');

-- CreateEnum
CREATE TYPE "MarcoInicialPrazoEntrega" AS ENUM ('ASSINATURA_CONTRATO', 'ORDEM_FORNECIMENTO', 'OUTRO');

-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "marcoInicialDescricao" TEXT,
ADD COLUMN     "marcoInicialPrazo" "MarcoInicialPrazoEntrega",
ADD COLUMN     "modalidadeEntrega" "ModalidadeEntrega" NOT NULL DEFAULT 'INTEGRAL';

-- CreateTable
CREATE TABLE "ParcelaContrato" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "prazoDias" INTEGER NOT NULL,
    "descricao" TEXT,
    "valorEstimado" DOUBLE PRECISION,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contratoId" TEXT NOT NULL,

    CONSTRAINT "ParcelaContrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParcelaContrato_contratoId_idx" ON "ParcelaContrato"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelaContrato_contratoId_numero_key" ON "ParcelaContrato"("contratoId", "numero");

-- AddForeignKey
ALTER TABLE "ParcelaContrato" ADD CONSTRAINT "ParcelaContrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
