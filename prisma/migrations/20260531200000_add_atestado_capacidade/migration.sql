-- Atestado de Capacidade Tecnica — emitido pelo orgao ao final de
-- Contrato/Ata. Empresa anexa o PDF pra ter catalogado (Regina 31/05).
CREATE TABLE "AtestadoCapacidade" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "orgaoEmissor" TEXT NOT NULL,
    "objeto" TEXT,
    "observacoes" TEXT,
    "arquivoPdfUrl" TEXT NOT NULL,
    "arquivoPdfNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ataId" TEXT,
    "contratoId" TEXT,

    CONSTRAINT "AtestadoCapacidade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AtestadoCapacidade_ataId_idx" ON "AtestadoCapacidade"("ataId");
CREATE INDEX "AtestadoCapacidade_contratoId_idx" ON "AtestadoCapacidade"("contratoId");

ALTER TABLE "AtestadoCapacidade" ADD CONSTRAINT "AtestadoCapacidade_ataId_fkey"
    FOREIGN KEY ("ataId") REFERENCES "Ata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtestadoCapacidade" ADD CONSTRAINT "AtestadoCapacidade_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
