-- Novo tipo de notificacao WhatsApp: lembrete semanal de envio de extrato
-- pra conciliacao bancaria. Regina 30/07.
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE IF NOT EXISTS 'LEMBRETE_EXTRATO_SEMANAL';
