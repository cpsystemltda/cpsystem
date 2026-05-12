-- Comissão fixa mensal ganha 4 estados (A_RECEBER/ATRASADO/PAGO/PAGO_PARCIAL),
-- vencimento por linha, valorRecebido (para Pago parcial) e comprovante.
-- Mantém os campos legados `paga` e `pagaEm` em sincronia: paga = status PAGO.

CREATE TYPE "StatusComissaoFixa" AS ENUM (
  'A_RECEBER',
  'ATRASADO',
  'PAGO',
  'PAGO_PARCIAL'
);

ALTER TABLE "PagamentoFixoMensal"
  ADD COLUMN IF NOT EXISTS "status" "StatusComissaoFixa" NOT NULL DEFAULT 'A_RECEBER',
  ADD COLUMN IF NOT EXISTS "vencimento" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "valorRecebido" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "comprovanteUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: status segue o campo legado `paga`. Linhas marcadas como pagas
-- ganham status PAGO + valorRecebido = valor.
UPDATE "PagamentoFixoMensal"
  SET "status" = 'PAGO',
      "valorRecebido" = "valor"
  WHERE "paga" = true;

-- Vencimento default: dia 5 do mês da competência (ajuste manual via UI quando
-- diferente). Backfill: extrai YYYY-MM da string `competencia`.
UPDATE "PagamentoFixoMensal"
  SET "vencimento" = (
    (SUBSTRING("competencia", 1, 4) || '-' || SUBSTRING("competencia", 6, 2) || '-05')::timestamp
  )
  WHERE "vencimento" IS NULL;

CREATE INDEX IF NOT EXISTS "PagamentoFixoMensal_status_idx" ON "PagamentoFixoMensal"("status");
