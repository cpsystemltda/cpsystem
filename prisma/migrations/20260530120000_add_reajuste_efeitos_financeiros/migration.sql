-- Data a partir da qual o reajuste tem efeitos financeiros no contrato.
-- Usado em TermoAditivo e Apostilamento. Nullable, sem default — coluna
-- adicionada de forma instantanea no PostgreSQL.
ALTER TABLE "TermoAditivo" ADD COLUMN "reajusteEfeitosFinanceiros" TIMESTAMP(3);
ALTER TABLE "Apostilamento" ADD COLUMN "reajusteEfeitosFinanceiros" TIMESTAMP(3);
