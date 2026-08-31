-- CreateTable
CREATE TABLE "MensagemInboundWhatsApp" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemInboundWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MensagemInboundWhatsApp_messageId_key" ON "MensagemInboundWhatsApp"("messageId");

-- CreateIndex
CREATE INDEX "MensagemInboundWhatsApp_criadoEm_idx" ON "MensagemInboundWhatsApp"("criadoEm");
