-- Adiciona status intermediário PAGO_AGUARDANDO_CONFIRMACAO no fluxo de comissão:
-- empresa marca como pago no /vinculos e o analista precisa confirmar recebimento
-- no painel dele antes de virar PAGO definitivo. Igor 30/07.
ALTER TYPE "StatusComissaoExecucao" ADD VALUE IF NOT EXISTS 'PAGO_AGUARDANDO_CONFIRMACAO';
