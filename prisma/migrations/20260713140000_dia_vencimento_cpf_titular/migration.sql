-- Regina 13/07/2026: cliente escolhe dia de vencimento fixo (10, 15 ou 20)
-- pra cobrança mensal recorrente + CPF do titular do cartão pra tokenização
-- Asaas. Aditivo, sem impacto retroativo.

ALTER TABLE "Conta" ADD COLUMN "diaVencimento" INTEGER;
ALTER TABLE "Conta" ADD COLUMN "cpfTitularCartao" TEXT;
