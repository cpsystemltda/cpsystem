-- ESP-009 (Igor 07/11/2026): checklist mensal de comprovação trabalhista e previdenciária.

-- CreateEnum
CREATE TYPE "StatusItemChecklist" AS ENUM ('PENDENTE', 'ANEXADO', 'ENVIADO', 'ACEITO', 'DEVOLVIDO');

-- CreateTable
CREATE TABLE "ChecklistItemModelo" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "temValidade" BOOLEAN NOT NULL DEFAULT false,
    "prazoDiaMesSeguinte" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItemModelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItemCompetencia" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "modeloId" TEXT,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "temValidade" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusItemChecklist" NOT NULL DEFAULT 'PENDENTE',
    "anexos" JSONB,
    "validade" TIMESTAMP(3),
    "reaproveitadoDeId" TEXT,
    "prazo" TIMESTAMP(3),
    "dataEnvio" TIMESTAMP(3),
    "dataAceite" TIMESTAMP(3),
    "motivoDevolucao" TEXT,
    "observacao" TEXT,
    "atualizadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItemCompetencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistItemModelo_contratoId_ordem_idx" ON "ChecklistItemModelo"("contratoId", "ordem");
CREATE INDEX "ChecklistItemCompetencia_competenciaId_idx" ON "ChecklistItemCompetencia"("competenciaId");
CREATE INDEX "ChecklistItemCompetencia_codigo_validade_idx" ON "ChecklistItemCompetencia"("codigo", "validade");

-- AddForeignKey
ALTER TABLE "ChecklistItemModelo" ADD CONSTRAINT "ChecklistItemModelo_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemCompetencia" ADD CONSTRAINT "ChecklistItemCompetencia_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "Competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
