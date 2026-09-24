-- AlterTable
ALTER TABLE "Empenho" ADD COLUMN     "responsavelId" TEXT;

-- CreateIndex
CREATE INDEX "Empenho_responsavelId_idx" ON "Empenho"("responsavelId");

-- AddForeignKey
ALTER TABLE "Empenho" ADD CONSTRAINT "Empenho_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
