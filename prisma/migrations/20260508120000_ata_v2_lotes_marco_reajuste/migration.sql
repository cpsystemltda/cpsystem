-- Cadastro Ata v2 — apontamentos do PDF
-- 1) FuncaoPontoFocal: novos valores (AUTORIDADE_COMPETENTE, FISCAL, OUTRO)
-- 2) Ata: prazoEntregaNaoAplica + marcoReajusteOrigem
-- 3) AtaItem: lote (agrupamento em lotes)
-- 4) PontoFocal: funcaoDescricao (rótulo livre quando funcao=OUTRO)

-- === Enum novo: MarcoReajusteOrigem ===
CREATE TYPE "MarcoReajusteOrigem" AS ENUM ('ORCAMENTO_ESTIMADO', 'ASSINATURA', 'OMISSA');

-- === Adicionar valores no enum FuncaoPontoFocal (Postgres não permite no transaction comum) ===
ALTER TYPE "FuncaoPontoFocal" ADD VALUE IF NOT EXISTS 'AUTORIDADE_COMPETENTE';
ALTER TYPE "FuncaoPontoFocal" ADD VALUE IF NOT EXISTS 'FISCAL';
ALTER TYPE "FuncaoPontoFocal" ADD VALUE IF NOT EXISTS 'OUTRO';

-- === Ata ===
ALTER TABLE "Ata" ADD COLUMN "prazoEntregaNaoAplica" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Ata" ADD COLUMN "marcoReajusteOrigem" "MarcoReajusteOrigem";

-- === AtaItem ===
ALTER TABLE "AtaItem" ADD COLUMN "lote" TEXT;

-- === PontoFocal ===
ALTER TABLE "PontoFocal" ADD COLUMN "funcaoDescricao" TEXT;
