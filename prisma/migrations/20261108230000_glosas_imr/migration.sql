-- ESP-005 (Igor 07/11/2026): medição, glosas e IMR na competência.

-- CreateEnum
CREATE TYPE "TipoGlosa" AS ENUM ('FALTA_NAO_COBERTA', 'POSTO_DESCOBERTO', 'IMR', 'MATERIAL_NAO_FORNECIDO', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusGlosa" AS ENUM ('APLICADA', 'CONTESTADA', 'MANTIDA', 'REVERTIDA');

-- AlterTable
ALTER TABLE "Competencia" ADD COLUMN "imrPontuacoes" JSONB;

-- CreateTable
CREATE TABLE "Glosa" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "contratoItemId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoGlosa" NOT NULL,
    "status" "StatusGlosa" NOT NULL DEFAULT 'APLICADA',
    "valor" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT NOT NULL,
    "arquivoUrl" TEXT,
    "competenciaOrigemRef" TEXT,
    "contestacao" TEXT,
    "contestadaEm" TIMESTAMP(3),
    "decididaEm" TIMESTAMP(3),
    "complementarId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Glosa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicadorImr" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "nome" TEXT NOT NULL,
    "meta" TEXT,
    "descricao" TEXT,
    "faixas" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicadorImr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Glosa_competenciaId_idx" ON "Glosa"("competenciaId");
CREATE INDEX "Glosa_contratoItemId_idx" ON "Glosa"("contratoItemId");
CREATE INDEX "IndicadorImr_contratoId_idx" ON "IndicadorImr"("contratoId");

-- AddForeignKey
ALTER TABLE "Glosa" ADD CONSTRAINT "Glosa_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "Competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Glosa" ADD CONSTRAINT "Glosa_contratoItemId_fkey" FOREIGN KEY ("contratoItemId") REFERENCES "ContratoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IndicadorImr" ADD CONSTRAINT "IndicadorImr_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
