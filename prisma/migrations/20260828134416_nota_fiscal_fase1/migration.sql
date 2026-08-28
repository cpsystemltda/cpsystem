-- CreateEnum
CREATE TYPE "ProvedorFiscal" AS ENUM ('FOCUS_NFE', 'DEMO');

-- CreateEnum
CREATE TYPE "AmbienteFiscal" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- CreateEnum
CREATE TYPE "RegimeTributarioFiscal" AS ENUM ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'MEI');

-- CreateEnum
CREATE TYPE "StatusNotaFiscal" AS ENUM ('PROCESSANDO', 'AUTORIZADA', 'ERRO', 'CANCELADA');

-- CreateTable
CREATE TABLE "ConfiguracaoFiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "provedor" "ProvedorFiscal" NOT NULL DEFAULT 'DEMO',
    "ambiente" "AmbienteFiscal" NOT NULL DEFAULT 'HOMOLOGACAO',
    "tokenCifrado" TEXT,
    "inscricaoMunicipal" TEXT,
    "inscricaoEstadual" TEXT,
    "codigoMunicipio" TEXT,
    "regime" "RegimeTributarioFiscal" NOT NULL DEFAULT 'SIMPLES_NACIONAL',
    "optanteSimples" BOOLEAN NOT NULL DEFAULT true,
    "incentivadorCultural" BOOLEAN NOT NULL DEFAULT false,
    "itemListaServico" TEXT,
    "codigoTributarioMunicipio" TEXT,
    "cnaeServico" TEXT,
    "aliquotaIss" DOUBLE PRECISION,
    "issRetidoPadrao" BOOLEAN NOT NULL DEFAULT false,
    "descricaoPadrao" TEXT,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "empenhoId" TEXT,
    "referencia" TEXT NOT NULL,
    "provedor" "ProvedorFiscal" NOT NULL,
    "ambiente" "AmbienteFiscal" NOT NULL,
    "status" "StatusNotaFiscal" NOT NULL DEFAULT 'PROCESSANDO',
    "numero" TEXT,
    "serie" TEXT,
    "codigoVerificacao" TEXT,
    "linkPrefeitura" TEXT,
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "valorServicos" DOUBLE PRECISION NOT NULL,
    "aliquotaIss" DOUBLE PRECISION,
    "valorIss" DOUBLE PRECISION,
    "issRetido" BOOLEAN NOT NULL DEFAULT false,
    "descricao" TEXT NOT NULL,
    "tomadorCnpj" TEXT NOT NULL,
    "tomadorRazaoSocial" TEXT NOT NULL,
    "tomadorEndereco" TEXT,
    "tomadorEmail" TEXT,
    "mensagemErro" TEXT,
    "respostaProvedor" JSONB,
    "criadoPorId" TEXT,
    "criadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "autorizadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoFiscal_empresaId_key" ON "ConfiguracaoFiscal"("empresaId");

-- CreateIndex
CREATE INDEX "ConfiguracaoFiscal_empresaId_idx" ON "ConfiguracaoFiscal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_referencia_key" ON "NotaFiscal"("referencia");

-- CreateIndex
CREATE INDEX "NotaFiscal_empresaId_criadoEm_idx" ON "NotaFiscal"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "NotaFiscal_empenhoId_idx" ON "NotaFiscal"("empenhoId");

-- CreateIndex
CREATE INDEX "NotaFiscal_status_idx" ON "NotaFiscal"("status");

-- AddForeignKey
ALTER TABLE "ConfiguracaoFiscal" ADD CONSTRAINT "ConfiguracaoFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE SET NULL ON UPDATE CASCADE;
