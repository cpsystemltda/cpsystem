-- Adiciona 3 novos valores ao enum TipoObjeto:
-- SERVICOS_DEDICACAO_EXCLUSIVA, LOCACAO, OBRAS_ENGENHARIA.
--
-- ALTER TYPE ... ADD VALUE não pode ser executado dentro de uma transaction
-- (limitação do Postgres). Usa-se IF NOT EXISTS pra ser idempotente.
ALTER TYPE "TipoObjeto" ADD VALUE IF NOT EXISTS 'SERVICOS_DEDICACAO_EXCLUSIVA';
ALTER TYPE "TipoObjeto" ADD VALUE IF NOT EXISTS 'LOCACAO';
ALTER TYPE "TipoObjeto" ADD VALUE IF NOT EXISTS 'OBRAS_ENGENHARIA';
