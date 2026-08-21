-- Acerto do historico de migrations (Regina 21/08).
--
-- Varias mudancas foram aplicadas em producao com `prisma db push`, que altera o
-- banco SEM registrar o passo. Producao ficou correta; o historico ficou para
-- tras: 37 colunas, 2 tipos, 3 valores de enum e 1 indice que nenhuma migration
-- cria. Na pratica, `migrate deploy` num banco vazio nao reproduzia o sistema —
-- o que inviabiliza ambiente novo, branch de preview e restauracao.
--
-- Toda instrucao aqui e NO-OP onde a coisa ja existe. Em producao esta migration
-- nao faz nada: so registra que o historico esta em dia. Em banco novo, completa
-- o que faltava. Nenhum dado e lido, alterado ou removido.

-- 1. Tipos enum que nunca foram criados por migration.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinalidadeApostilamento') THEN
        CREATE TYPE "FinalidadeApostilamento" AS ENUM ('REAJUSTE', 'APLICACAO_PENALIDADE', 'EMPENHO_CREDITO_SUPLEMENTAR', 'OUTROS');
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoAlteracaoValor') THEN
        CREATE TYPE "TipoAlteracaoValor" AS ENUM ('ACRESCIMO', 'SUPRESSAO', 'REAJUSTE_REPACTUACAO', 'REEQUILIBRIO');
    END IF;
END $$;

-- 2. Valores acrescentados a um enum que ja existia.
ALTER TYPE "IndiceReajuste" ADD VALUE IF NOT EXISTS 'IPCA_15';
ALTER TYPE "IndiceReajuste" ADD VALUE IF NOT EXISTS 'IPCA_E';
ALTER TYPE "IndiceReajuste" ADD VALUE IF NOT EXISTS 'IST';

-- 3. Colunas ausentes (37).
-- AndamentoNotificacao
ALTER TABLE "AndamentoNotificacao" ADD COLUMN IF NOT EXISTS "arquivoPdfUrl" text;
-- Apostilamento
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "aplicaReajuste" boolean DEFAULT false NOT NULL;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "atualizadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "dadosAnteriores" jsonb;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "finalidade" "FinalidadeApostilamento";
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "motivo" text;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "novaVigenciaInicio" timestamp(3) without time zone;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "novaVigenciaPrazo" integer;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "novaVigenciaUnidade" "PrazoEntregaUnidade";
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "novoPrazoEntregaUnidade" "PrazoEntregaUnidade";
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "reajusteIndice" "IndiceReajuste";
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "reajusteIndiceOutro" text;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "reajustePercentual" double precision;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "reajustePeriodoFim" timestamp(3) without time zone;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "reajustePeriodoInicio" timestamp(3) without time zone;
ALTER TABLE "Apostilamento" ADD COLUMN IF NOT EXISTS "tipoAlteracaoValor" "TipoAlteracaoValor";
-- Contrato
ALTER TABLE "Contrato" ADD COLUMN IF NOT EXISTS "valorInicial" double precision;
-- Empenho
ALTER TABLE "Empenho" ADD COLUMN IF NOT EXISTS "arquivoDespacho" text;
ALTER TABLE "Empenho" ADD COLUMN IF NOT EXISTS "arquivoEntrega" text;
ALTER TABLE "Empenho" ADD COLUMN IF NOT EXISTS "arquivoNfEmitida" text;
ALTER TABLE "Empenho" ADD COLUMN IF NOT EXISTS "arquivoNfEncaminhada" text;
ALTER TABLE "Empenho" ADD COLUMN IF NOT EXISTS "arquivoPagamento" text;
ALTER TABLE "Empenho" ADD COLUMN IF NOT EXISTS "arquivoPedidoRecebido" text;
-- ProcedimentoApuratorio
ALTER TABLE "ProcedimentoApuratorio" ADD COLUMN IF NOT EXISTS "comissaoMembros" text[] DEFAULT ARRAY[]::text[];
-- TermoAditivo
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "aplicaReajuste" boolean DEFAULT false NOT NULL;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "atualizadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "dadosAnteriores" jsonb;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "novaVigenciaInicio" timestamp(3) without time zone;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "novaVigenciaPrazo" integer;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "novaVigenciaUnidade" "PrazoEntregaUnidade";
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "novoPrazoEntregaUnidade" "PrazoEntregaUnidade";
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "reajusteIndice" "IndiceReajuste";
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "reajusteIndiceOutro" text;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "reajustePercentual" double precision;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "reajustePeriodoFim" timestamp(3) without time zone;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "reajustePeriodoInicio" timestamp(3) without time zone;
ALTER TABLE "TermoAditivo" ADD COLUMN IF NOT EXISTS "tipoAlteracaoValor" "TipoAlteracaoValor";

-- 4. Indice unico ausente.
CREATE UNIQUE INDEX IF NOT EXISTS "EventoGoogleCalendar_googleAccountId_entidadeTipo_entidadeI_key" ON public."EventoGoogleCalendar" USING btree ("googleAccountId", "entidadeTipo", "entidadeId");
