-- Regina 13/07/2026: novo plano Intermediário R$ 597 (proposta Igor).
-- Postgres exige adicionar valor no enum em transação separada.
ALTER TYPE "Plano" ADD VALUE 'INTERMEDIARIO';
