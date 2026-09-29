-- AlterEnum
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE 'PORTAL_TRANSPARENCIA';

-- AlterTable
ALTER TABLE "NotaFiscalPortal" ADD COLUMN     "avisadoEm" TIMESTAMP(3);
