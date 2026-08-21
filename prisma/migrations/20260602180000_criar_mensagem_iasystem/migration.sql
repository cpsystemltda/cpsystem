-- Cria a MensagemIAsystem, que nunca teve migration de criacao.
--
-- A tabela nasceu em producao por `prisma db push` (schema aplicado direto, sem
-- gerar migration). Producao ficou correta, mas o HISTORICO ficou quebrado: num
-- banco vazio, a migration seguinte (20260602190000_mensagem_iasystem_soft_delete)
-- tenta ALTER numa tabela que ninguem criou e o `migrate deploy` para ali.
-- Isso inviabiliza recriar o banco, abrir branch de preview ou montar ambiente
-- novo — inclusive o de teste.
--
-- Escrita pra ser NO-OP onde a tabela ja existe (producao): CREATE TABLE IF NOT
-- EXISTS, indice IF NOT EXISTS e a FK dentro de um guarda que checa pg_constraint,
-- porque o Postgres nao tem ADD CONSTRAINT IF NOT EXISTS.
--
-- Sem a coluna `deletadaEm` de proposito: quem adiciona ela e a migration
-- seguinte. Criar aqui faria aquela quebrar com "column already exists".
CREATE TABLE IF NOT EXISTS "MensagemIAsystem" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MensagemIAsystem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MensagemIAsystem_usuarioId_criadoEm_idx"
    ON "MensagemIAsystem"("usuarioId", "criadoEm");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MensagemIAsystem_usuarioId_fkey'
    ) THEN
        ALTER TABLE "MensagemIAsystem"
            ADD CONSTRAINT "MensagemIAsystem_usuarioId_fkey"
            FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
