-- Reajuste retroativo numa execução (Empenho) específica. Estende a
-- timeline da execução com 3 marcos novos (NF complementar emitida,
-- encaminhada, paga). 1:1 com Empenho.

CREATE TABLE "ReajusteRetroativo" (
    "id" TEXT NOT NULL,
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "valorReajustado" DOUBLE PRECISION NOT NULL,
    "diferenca" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "dataAplicacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataNfEmitida" TIMESTAMP(3),
    "arquivoNfEmitida" TEXT,
    "dataNfEncaminhada" TIMESTAMP(3),
    "arquivoNfEncaminhada" TEXT,
    "dataPagamento" TIMESTAMP(3),
    "arquivoPagamento" TEXT,
    "empenhoId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReajusteRetroativo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReajusteRetroativo_empenhoId_key" ON "ReajusteRetroativo"("empenhoId");
CREATE INDEX "ReajusteRetroativo_empenhoId_idx" ON "ReajusteRetroativo"("empenhoId");
CREATE INDEX "ReajusteRetroativo_criadoPorId_idx" ON "ReajusteRetroativo"("criadoPorId");

ALTER TABLE "ReajusteRetroativo"
    ADD CONSTRAINT "ReajusteRetroativo_empenhoId_fkey"
    FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReajusteRetroativo"
    ADD CONSTRAINT "ReajusteRetroativo_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
