-- Novo tipo de notificacao WA (bypassa opt-in + cap diario — critico).
-- Em migration separada pq ALTER TYPE ADD VALUE nao roda em transacao
-- com outros DDL no Postgres.
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE IF NOT EXISTS 'SEGURANCA_LOGIN_NOVO_DEVICE';
