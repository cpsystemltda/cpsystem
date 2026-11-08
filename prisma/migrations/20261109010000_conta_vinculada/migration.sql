-- ESP-006 (Igor 07/11/2026): conta vinculada e pagamento pelo fato gerador.

-- CreateEnum
CREATE TYPE "GarantiaVerbasTrabalhistas" AS ENUM ('CONTA_VINCULADA', 'FATO_GERADOR', 'NENHUMA', 'OUTRA');
CREATE TYPE "FatoGeradorLiberacao" AS ENUM ('FERIAS', 'DECIMO_TERCEIRO', 'RESCISAO', 'OUTRO');
CREATE TYPE "StatusPedidoLiberacao" AS ENUM ('RASCUNHO', 'PROTOCOLADO', 'EM_ANALISE', 'DEFERIDO_PARCIAL', 'DEFERIDO', 'INDEFERIDO');

-- AlterTable Contrato
ALTER TABLE "Contrato"
  ADD COLUMN "garantiaVerbas" "GarantiaVerbasTrabalhistas",
  ADD COLUMN "garantiaVerbasOutra" TEXT,
  ADD COLUMN "ratPct" INTEGER,
  ADD COLUMN "percentuaisContaVinculada" JSONB,
  ADD COLUMN "prazoAlertaLiberacaoDias" INTEGER;

-- AlterTable Competencia
ALTER TABLE "Competencia"
  ADD COLUMN "retencaoCvEstimada" DOUBLE PRECISION,
  ADD COLUMN "retencaoCvDetalhe" JSONB,
  ADD COLUMN "retencaoCvInformada" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "PedidoLiberacaoVerbas" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "fatoGerador" "FatoGeradorLiberacao" NOT NULL,
    "fatoGeradorOutro" TEXT,
    "competenciaRef" TEXT,
    "colaboradores" TEXT,
    "valorSolicitado" DOUBLE PRECISION NOT NULL,
    "documentos" JSONB,
    "dataPedido" TIMESTAMP(3) NOT NULL,
    "protocolo" TEXT,
    "status" "StatusPedidoLiberacao" NOT NULL DEFAULT 'RASCUNHO',
    "valorLiberado" DOUBLE PRECISION,
    "dataLiberacao" TIMESTAMP(3),
    "observacoes" TEXT,
    "minuta" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoLiberacaoVerbas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtratoContaVinculada" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "dataSaldo" TIMESTAMP(3) NOT NULL,
    "saldoBanco" DOUBLE PRECISION NOT NULL,
    "rendimentos" DOUBLE PRECISION,
    "arquivoUrl" TEXT,
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtratoContaVinculada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroPlataforma" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPorId" TEXT,

    CONSTRAINT "ParametroPlataforma_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "PedidoLiberacaoVerbas_contratoId_status_idx" ON "PedidoLiberacaoVerbas"("contratoId", "status");
CREATE INDEX "ExtratoContaVinculada_contratoId_dataSaldo_idx" ON "ExtratoContaVinculada"("contratoId", "dataSaldo");

-- AddForeignKey
ALTER TABLE "PedidoLiberacaoVerbas" ADD CONSTRAINT "PedidoLiberacaoVerbas_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtratoContaVinculada" ADD CONSTRAINT "ExtratoContaVinculada_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
