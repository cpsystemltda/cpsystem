-- ESP-004 (Igor 07/11/2026): competências mensais automáticas em contrato de
-- mão de obra + versão de itens por aditivo (ESP-002 RN07).

-- CreateEnum
CREATE TYPE "StatusCompetencia" AS ENUM ('A_CONFIRMAR', 'EM_EXECUCAO', 'MEDICAO', 'DOC_TRABALHISTA', 'NF_EMITIDA', 'NF_ENCAMINHADA', 'ATESTADA', 'PAGA');

-- CreateEnum
CREATE TYPE "TipoCompetencia" AS ENUM ('REGULAR', 'COMPLEMENTAR');

-- AlterTable Contrato
ALTER TABLE "Contrato"
  ADD COLUMN "retencoesPadrao" JSONB,
  ADD COLUMN "competenciasRetroativasEm" TIMESTAMP(3),
  ADD COLUMN "competenciasRetroativasGerar" BOOLEAN,
  ADD COLUMN "suspensaoInicio" TIMESTAMP(3),
  ADD COLUMN "suspensaoFim" TIMESTAMP(3);

-- AlterTable ContratoItem
ALTER TABLE "ContratoItem"
  ADD COLUMN "vigenteDe" TIMESTAMP(3),
  ADD COLUMN "vigenteAte" TIMESTAMP(3),
  ADD COLUMN "substituiItemId" TEXT,
  ADD COLUMN "alteradoPorAditivoId" TEXT;

-- CreateTable
CREATE TABLE "Competencia" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "vigenciaId" TEXT,
    "tipo" "TipoCompetencia" NOT NULL DEFAULT 'REGULAR',
    "competencia" TEXT NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "diasPeriodo" INTEGER NOT NULL,
    "diasBase" INTEGER NOT NULL,
    "valorMensalBase" DOUBLE PRECISION NOT NULL,
    "valorPrevisto" DOUBLE PRECISION NOT NULL,
    "ajustes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ajustesJustificativa" TEXT,
    "valorGlosas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorFaturado" DOUBLE PRECISION,
    "retencoes" JSONB,
    "valorRetencoes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorLiquidoEsperado" DOUBLE PRECISION,
    "valorRecebido" DOUBLE PRECISION,
    "status" "StatusCompetencia" NOT NULL DEFAULT 'EM_EXECUCAO',
    "dataMedicao" TIMESTAMP(3),
    "responsavelMedicao" TEXT,
    "arquivoMedicao" TEXT,
    "dataDocTrabalhista" TIMESTAMP(3),
    "responsavelDocTrabalhista" TEXT,
    "arquivoDocTrabalhista" TEXT,
    "dataNfEmitida" TIMESTAMP(3),
    "numeroNf" TEXT,
    "responsavelNfEmitida" TEXT,
    "arquivoNfEmitida" TEXT,
    "dataNfEncaminhada" TIMESTAMP(3),
    "responsavelNfEncaminhada" TEXT,
    "arquivoNfEncaminhada" TEXT,
    "dataAteste" TIMESTAMP(3),
    "responsavelAteste" TEXT,
    "arquivoAteste" TEXT,
    "dataPagamento" TIMESTAMP(3),
    "responsavelPagamento" TEXT,
    "arquivoPagamento" TEXT,
    "prazoPagamento" TIMESTAMP(3),
    "complementarRef" TEXT,
    "complementarDetalhe" JSONB,
    "criadaAutomaticamente" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenciaEmpenho" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "empenhoId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION,

    CONSTRAINT "CompetenciaEmpenho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competencia_contratoId_competencia_idx" ON "Competencia"("contratoId", "competencia");
CREATE INDEX "Competencia_vigenciaId_idx" ON "Competencia"("vigenciaId");
CREATE INDEX "Competencia_status_idx" ON "Competencia"("status");
CREATE UNIQUE INDEX "CompetenciaEmpenho_competenciaId_empenhoId_key" ON "CompetenciaEmpenho"("competenciaId", "empenhoId");
CREATE INDEX "CompetenciaEmpenho_empenhoId_idx" ON "CompetenciaEmpenho"("empenhoId");

-- AddForeignKey
ALTER TABLE "ContratoItem" ADD CONSTRAINT "ContratoItem_alteradoPorAditivoId_fkey" FOREIGN KEY ("alteradoPorAditivoId") REFERENCES "TermoAditivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Competencia" ADD CONSTRAINT "Competencia_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Competencia" ADD CONSTRAINT "Competencia_vigenciaId_fkey" FOREIGN KEY ("vigenciaId") REFERENCES "Vigencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetenciaEmpenho" ADD CONSTRAINT "CompetenciaEmpenho_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "Competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenciaEmpenho" ADD CONSTRAINT "CompetenciaEmpenho_empenhoId_fkey" FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id") ON DELETE CASCADE ON UPDATE CASCADE;
