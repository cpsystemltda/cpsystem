-- CreateTable
CREATE TABLE "DespesaPlataforma" (
    "id" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DespesaPlataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DespesaPlataforma_competencia_idx" ON "DespesaPlataforma"("competencia");
