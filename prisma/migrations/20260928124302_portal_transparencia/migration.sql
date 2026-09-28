-- CreateEnum
CREATE TYPE "FaseDespesaPortal" AS ENUM ('EMPENHO', 'LIQUIDACAO', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "ConfiancaConciliacao" AS ENUM ('CONFIRMADO', 'PROVAVEL');

-- CreateTable
CREATE TABLE "DocumentoPortal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "fase" "FaseDespesaPortal" NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoResumido" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "codigoUg" TEXT,
    "ug" TEXT,
    "codigoOrgao" TEXT,
    "orgao" TEXT,
    "numeroProcesso" TEXT,
    "codigoEmpenhoPortal" TEXT,
    "empenhoId" TEXT,
    "avisadoEm" TIMESTAMP(3),
    "sincronizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscalPortal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "orgaoDestinatario" TEXT,
    "ultimoEvento" TEXT,
    "notaFiscalId" TEXT,
    "sincronizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscalPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConciliacaoPortal" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "confianca" "ConfiancaConciliacao" NOT NULL,
    "motivo" TEXT NOT NULL,
    "confirmadoPorId" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "recusadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciliacaoPortal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentoPortal_empresaId_fase_idx" ON "DocumentoPortal"("empresaId", "fase");

-- CreateIndex
CREATE INDEX "DocumentoPortal_empenhoId_idx" ON "DocumentoPortal"("empenhoId");

-- CreateIndex
CREATE INDEX "DocumentoPortal_codigoEmpenhoPortal_idx" ON "DocumentoPortal"("codigoEmpenhoPortal");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoPortal_empresaId_fase_codigo_key" ON "DocumentoPortal"("empresaId", "fase", "codigo");

-- CreateIndex
CREATE INDEX "NotaFiscalPortal_empresaId_idx" ON "NotaFiscalPortal"("empresaId");

-- CreateIndex
CREATE INDEX "NotaFiscalPortal_notaFiscalId_idx" ON "NotaFiscalPortal"("notaFiscalId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalPortal_empresaId_chave_key" ON "NotaFiscalPortal"("empresaId", "chave");

-- CreateIndex
CREATE INDEX "ConciliacaoPortal_notaFiscalId_idx" ON "ConciliacaoPortal"("notaFiscalId");

-- CreateIndex
CREATE UNIQUE INDEX "ConciliacaoPortal_pagamentoId_notaFiscalId_key" ON "ConciliacaoPortal"("pagamentoId", "notaFiscalId");

-- AddForeignKey
ALTER TABLE "DocumentoPortal" ADD CONSTRAINT "DocumentoPortal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoPortal" ADD CONSTRAINT "DocumentoPortal_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalPortal" ADD CONSTRAINT "NotaFiscalPortal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalPortal" ADD CONSTRAINT "NotaFiscalPortal_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoPortal" ADD CONSTRAINT "ConciliacaoPortal_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "DocumentoPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoPortal" ADD CONSTRAINT "ConciliacaoPortal_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConciliacaoPortal" ADD CONSTRAINT "ConciliacaoPortal_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
