-- Novo tipo de notificacao WhatsApp: BOAS_VINDAS.
-- Aditivo puro: acrescenta valor ao enum, nao altera dado nem coluna existente.
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE IF NOT EXISTS 'BOAS_VINDAS';
