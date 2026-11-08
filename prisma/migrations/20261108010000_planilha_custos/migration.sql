-- CreateTable
CREATE TABLE "PlanilhaCustos" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "contratoItemId" TEXT,
    "funcao" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "dataEfeito" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL,
    "origemRef" TEXT,
    "cct" TEXT,
    "totalMensal" DOUBLE PRECISION NOT NULL,
    "justificativaDivergencia" TEXT,
    "mapeamentoARevisar" BOOLEAN NOT NULL DEFAULT false,
    "arquivoUrl" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanilhaCustos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanilhaCustosLinha" (
    "id" TEXT NOT NULL,
    "planilhaId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "percentual" DOUBLE PRECISION,
    "valor" DOUBLE PRECISION NOT NULL,
    "aRevisar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanilhaCustosLinha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanilhaCustos_contratoId_idx" ON "PlanilhaCustos"("contratoId");

-- CreateIndex
CREATE INDEX "PlanilhaCustos_contratoItemId_idx" ON "PlanilhaCustos"("contratoItemId");

-- CreateIndex
CREATE INDEX "PlanilhaCustosLinha_planilhaId_idx" ON "PlanilhaCustosLinha"("planilhaId");

-- AddForeignKey
ALTER TABLE "PlanilhaCustos" ADD CONSTRAINT "PlanilhaCustos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanilhaCustos" ADD CONSTRAINT "PlanilhaCustos_contratoItemId_fkey" FOREIGN KEY ("contratoItemId") REFERENCES "ContratoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanilhaCustosLinha" ADD CONSTRAINT "PlanilhaCustosLinha_planilhaId_fkey" FOREIGN KEY ("planilhaId") REFERENCES "PlanilhaCustos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
