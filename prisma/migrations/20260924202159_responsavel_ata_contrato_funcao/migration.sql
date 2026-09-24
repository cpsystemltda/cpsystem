-- AlterTable
ALTER TABLE "Ata" ADD COLUMN     "responsavelId" TEXT;

-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "responsavelId" TEXT;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "funcaoNaEmpresa" TEXT;

-- AddForeignKey
ALTER TABLE "Ata" ADD CONSTRAINT "Ata_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
