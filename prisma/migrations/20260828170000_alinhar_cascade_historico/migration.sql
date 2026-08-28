-- Alinha o HISTORICO de migrations ao que producao ja faz.
--
-- Contexto (28/08): estas seis chaves estrangeiras estao com ON DELETE CASCADE
-- em producao — foram criadas por `db push` na epoca em que o historico ficou
-- para tras — mas as migrations que as criaram nao tinham o CASCADE. Resultado:
-- um banco construido a partir do historico (ambiente novo, restore, preview,
-- banco de teste local) nascia com comportamento DIFERENTE do de producao.
--
-- O risco nao e teorico: e testar local num banco que apaga em cascata de um
-- jeito e produzir outro em producao. Aqui producao nao muda nada (ja esta
-- assim); quem passa a bater e o historico.
--
-- Custo: metadado. As tabelas tem 132 linhas (ComissaoExecucao) e 0 nas demais.

ALTER TABLE "ComissaoExecucao" DROP CONSTRAINT IF EXISTS "ComissaoExecucao_empenhoId_fkey";
ALTER TABLE "ComissaoExecucao" ADD CONSTRAINT "ComissaoExecucao_empenhoId_fkey"
  FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComissaoExecucao" DROP CONSTRAINT IF EXISTS "ComissaoExecucao_vinculoId_fkey";
ALTER TABLE "ComissaoExecucao" ADD CONSTRAINT "ComissaoExecucao_vinculoId_fkey"
  FOREIGN KEY ("vinculoId") REFERENCES "VinculoAnalista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComissaoExecucao" DROP CONSTRAINT IF EXISTS "ComissaoExecucao_analistaId_fkey";
ALTER TABLE "ComissaoExecucao" ADD CONSTRAINT "ComissaoExecucao_analistaId_fkey"
  FOREIGN KEY ("analistaId") REFERENCES "Analista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Extrato" DROP CONSTRAINT IF EXISTS "Extrato_contaId_fkey";
ALTER TABLE "Extrato" ADD CONSTRAINT "Extrato_contaId_fkey"
  FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TransacaoExtrato" DROP CONSTRAINT IF EXISTS "TransacaoExtrato_extratoId_fkey";
ALTER TABLE "TransacaoExtrato" ADD CONSTRAINT "TransacaoExtrato_extratoId_fkey"
  FOREIGN KEY ("extratoId") REFERENCES "Extrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Conciliacao" DROP CONSTRAINT IF EXISTS "Conciliacao_transacaoId_fkey";
ALTER TABLE "Conciliacao" ADD CONSTRAINT "Conciliacao_transacaoId_fkey"
  FOREIGN KEY ("transacaoId") REFERENCES "TransacaoExtrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
