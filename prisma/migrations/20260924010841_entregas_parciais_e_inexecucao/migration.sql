-- CreateEnum
CREATE TYPE "TipoEntregaEmpenho" AS ENUM ('TOTAL', 'PARCIAL', 'INEXECUCAO_TOTAL', 'INEXECUCAO_PARCIAL');

-- CreateTable
CREATE TABLE "EntregaEmpenho" (
    "id" TEXT NOT NULL,
    "empenhoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "TipoEntregaEmpenho" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "arquivoUrl" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaEmpenho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntregaEmpenhoItem" (
    "id" TEXT NOT NULL,
    "entregaId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EntregaEmpenhoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntregaEmpenho_empenhoId_idx" ON "EntregaEmpenho"("empenhoId");

-- CreateIndex
CREATE INDEX "EntregaEmpenho_criadoPorId_idx" ON "EntregaEmpenho"("criadoPorId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaEmpenho_empenhoId_ordem_key" ON "EntregaEmpenho"("empenhoId", "ordem");

-- CreateIndex
CREATE INDEX "EntregaEmpenhoItem_entregaId_idx" ON "EntregaEmpenhoItem"("entregaId");

-- CreateIndex
CREATE INDEX "EntregaEmpenhoItem_itemId_idx" ON "EntregaEmpenhoItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "EntregaEmpenhoItem_entregaId_itemId_key" ON "EntregaEmpenhoItem"("entregaId", "itemId");

-- AddForeignKey
ALTER TABLE "EntregaEmpenho" ADD CONSTRAINT "EntregaEmpenho_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaEmpenho" ADD CONSTRAINT "EntregaEmpenho_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaEmpenhoItem" ADD CONSTRAINT "EntregaEmpenhoItem_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "EntregaEmpenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntregaEmpenhoItem" ADD CONSTRAINT "EntregaEmpenhoItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EmpenhoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
