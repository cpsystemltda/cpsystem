-- CreateTable
CREATE TABLE "MensagemSaidaWhatsApp" (
    "id" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "documentoUrl" TEXT,
    "nomeArquivo" TEXT,
    "usuarioId" TEXT,
    "tipo" TEXT,
    "notificacaoId" TEXT,
    "status" "StatusNotificacaoWhatsApp" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),

    CONSTRAINT "MensagemSaidaWhatsApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MensagemSaidaWhatsApp_status_criadoEm_idx" ON "MensagemSaidaWhatsApp"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "MensagemSaidaWhatsApp_usuarioId_idx" ON "MensagemSaidaWhatsApp"("usuarioId");
