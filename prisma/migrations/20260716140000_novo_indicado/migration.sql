-- Regina 16/07: NOVO_INDICADO no enum de notificacao do sistema.
-- Notifica embaixador quando alguem se cadastra via ?ref dele. NAO
-- confundir com VINCULO_CRIADO (que e do analista, VinculoAnalista B2G).
ALTER TYPE "TipoNotificacaoSistema" ADD VALUE 'NOVO_INDICADO';
