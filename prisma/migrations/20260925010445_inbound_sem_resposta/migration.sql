-- AlterTable
ALTER TABLE "MensagemInboundWhatsApp" ADD COLUMN     "chatJid" TEXT,
ADD COLUMN     "cobradaEm" TIMESTAMP(3),
ADD COLUMN     "ehSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pushName" TEXT,
ADD COLUMN     "respondidaEm" TIMESTAMP(3),
ADD COLUMN     "texto" TEXT;

-- CreateIndex
CREATE INDEX "MensagemInboundWhatsApp_respondidaEm_idx" ON "MensagemInboundWhatsApp"("respondidaEm");
