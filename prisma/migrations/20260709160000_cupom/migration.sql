-- Sistema de cupons: trial estendido + vinculo analista automatico.
-- Regina 09/07/2026 apos pedido do Igor (cliente novo em beta 60d).

CREATE TABLE "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "diasTrial" INTEGER NOT NULL DEFAULT 60,
    "analistaVinculadoId" TEXT,
    "validoAte" TIMESTAMP(3),
    "usosMaximos" INTEGER,
    "usosAtuais" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");
CREATE INDEX "Cupom_codigo_idx" ON "Cupom"("codigo");
CREATE INDEX "Cupom_ativo_idx" ON "Cupom"("ativo");
CREATE INDEX "Cupom_analistaVinculadoId_idx" ON "Cupom"("analistaVinculadoId");

ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_analistaVinculadoId_fkey"
    FOREIGN KEY ("analistaVinculadoId") REFERENCES "Analista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conta recebe FK opcional pro cupom aplicado
ALTER TABLE "Conta" ADD COLUMN "cupomAplicadoId" TEXT;
CREATE INDEX "Conta_cupomAplicadoId_idx" ON "Conta"("cupomAplicadoId");
ALTER TABLE "Conta" ADD CONSTRAINT "Conta_cupomAplicadoId_fkey"
    FOREIGN KEY ("cupomAplicadoId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
