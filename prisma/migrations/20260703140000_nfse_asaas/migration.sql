-- NFSe emitida pelo Asaas (Regina 03/07): quando cobranca vira PAGA e
-- Asaas emite NF automaticamente, o webhook INVOICE_CREATED nos avisa.
-- Guardamos aqui pra referencia, envio via WhatsApp e historico.

ALTER TABLE "Cobranca" ADD COLUMN "nfseId" TEXT;
ALTER TABLE "Cobranca" ADD COLUMN "nfseNumero" TEXT;
ALTER TABLE "Cobranca" ADD COLUMN "nfseStatus" TEXT;
ALTER TABLE "Cobranca" ADD COLUMN "nfsePdfUrl" TEXT;
ALTER TABLE "Cobranca" ADD COLUMN "nfseXmlUrl" TEXT;
ALTER TABLE "Cobranca" ADD COLUMN "nfseEmitidaEm" TIMESTAMP(3);

-- Novo tipo de notificacao WhatsApp: NF emitida (link pro PDF)
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE 'NF_EMITIDA_CLIENTE';
