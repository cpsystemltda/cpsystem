-- Phase 1 — Saldo por vigência: adiciona model Vigencia e FKs em
-- ContratoItem, AtaItem e Empenho. Tudo nullable inicialmente — backfill
-- subsequente atribui Vigência 1 pra registros pré-feature.
--
-- Decisões:
-- - Vigencia é polimórfica (contratoId OU ataId, não ambos)
-- - termoAditivoId é único (cada aditivo origina no máx. 1 vigência)
-- - @@unique(contratoId, ordem) e @@unique(ataId, ordem) garantem
--   numeração sequencial sem colisão
-- - onDelete cascade pra Contrato/Ata pais (apaga vigências junto)
-- - onDelete SetNull pra TermoAditivo (apaga aditivo mas mantém vigência)

-- CreateTable
CREATE TABLE "Vigencia" (
    "id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "termoAditivoId" TEXT,
    "contratoId" TEXT,
    "ataId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vigencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vigencia_termoAditivoId_key" ON "Vigencia"("termoAditivoId");
CREATE UNIQUE INDEX "Vigencia_contratoId_ordem_key" ON "Vigencia"("contratoId", "ordem");
CREATE UNIQUE INDEX "Vigencia_ataId_ordem_key" ON "Vigencia"("ataId", "ordem");
CREATE INDEX "Vigencia_contratoId_idx" ON "Vigencia"("contratoId");
CREATE INDEX "Vigencia_ataId_idx" ON "Vigencia"("ataId");

-- AddForeignKey
ALTER TABLE "Vigencia"
    ADD CONSTRAINT "Vigencia_termoAditivoId_fkey"
    FOREIGN KEY ("termoAditivoId") REFERENCES "TermoAditivo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vigencia"
    ADD CONSTRAINT "Vigencia_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vigencia"
    ADD CONSTRAINT "Vigencia_ataId_fkey"
    FOREIGN KEY ("ataId") REFERENCES "Ata"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: ContratoItem, AtaItem e Empenho ganham vigenciaId nullable.
-- Backfill posterior popula tudo apontando pra Vigência 1.
ALTER TABLE "ContratoItem" ADD COLUMN "vigenciaId" TEXT;
ALTER TABLE "AtaItem" ADD COLUMN "vigenciaId" TEXT;
ALTER TABLE "Empenho" ADD COLUMN "vigenciaId" TEXT;

-- CreateIndex
CREATE INDEX "ContratoItem_vigenciaId_idx" ON "ContratoItem"("vigenciaId");
CREATE INDEX "AtaItem_vigenciaId_idx" ON "AtaItem"("vigenciaId");
CREATE INDEX "Empenho_vigenciaId_idx" ON "Empenho"("vigenciaId");

-- AddForeignKey
ALTER TABLE "ContratoItem"
    ADD CONSTRAINT "ContratoItem_vigenciaId_fkey"
    FOREIGN KEY ("vigenciaId") REFERENCES "Vigencia"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AtaItem"
    ADD CONSTRAINT "AtaItem_vigenciaId_fkey"
    FOREIGN KEY ("vigenciaId") REFERENCES "Vigencia"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Empenho"
    ADD CONSTRAINT "Empenho_vigenciaId_fkey"
    FOREIGN KEY ("vigenciaId") REFERENCES "Vigencia"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
