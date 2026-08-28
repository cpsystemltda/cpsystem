-- Controle de notas: nota emitida por fora, registrada aqui, e o aviso de
-- "hora de solicitar a nota" disparado pela entrega.
ALTER TYPE "ProvedorFiscal" ADD VALUE IF NOT EXISTS 'EXTERNA';
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE IF NOT EXISTS 'SOLICITAR_NOTA';
