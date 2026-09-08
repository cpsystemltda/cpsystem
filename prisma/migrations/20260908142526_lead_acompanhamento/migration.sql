-- AlterTable
ALTER TABLE "LeadProspeccao" ADD COLUMN     "contatoNome" TEXT,
ADD COLUMN     "dataPrimeiroContato" TIMESTAMP(3),
ADD COLUMN     "dataUltimoContato" TIMESTAMP(3),
ADD COLUMN     "retornarEm" TIMESTAMP(3),
ADD COLUMN     "teveRetorno" BOOLEAN NOT NULL DEFAULT false;
