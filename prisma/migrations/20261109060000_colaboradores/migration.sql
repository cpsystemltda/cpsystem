-- ESP-008 (Igor 07/11/2026): colaboradores e alocação em postos.

-- CreateEnum
CREATE TYPE "SituacaoColaborador" AS ENUM ('ATIVO', 'AFASTADO', 'DESLIGADO');
CREATE TYPE "TipoAlocacao" AS ENUM ('TITULAR', 'COBERTURA', 'VOLANTE');

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpfCifrado" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "cpfMascarado" TEXT NOT NULL,
    "dataAdmissao" TIMESTAMP(3) NOT NULL,
    "funcao" TEXT NOT NULL,
    "cbo" TEXT,
    "jornada" TEXT,
    "situacao" "SituacaoColaborador" NOT NULL DEFAULT 'ATIVO',
    "dataDesligamento" TIMESTAMP(3),
    "telefone" TEXT,
    "vinculoAnteriorId" TEXT,
    "anonimizadoEm" TIMESTAMP(3),
    "avisoAnonimizacaoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alocacao" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "contratoItemId" TEXT,
    "tipo" "TipoAlocacao" NOT NULL DEFAULT 'TITULAR',
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "motivoFim" TEXT,
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alocacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Colaborador_contaId_situacao_idx" ON "Colaborador"("contaId", "situacao");
CREATE INDEX "Colaborador_contaId_cpfHash_idx" ON "Colaborador"("contaId", "cpfHash");
-- Um CPF ativo (não desligado, não anonimizado) por conta; readmissão cria vínculo novo depois do desligamento.
CREATE UNIQUE INDEX "Colaborador_conta_cpf_vigente_key" ON "Colaborador"("contaId", "cpfHash") WHERE "situacao" <> 'DESLIGADO' AND "anonimizadoEm" IS NULL;
CREATE INDEX "Alocacao_contratoId_dataInicio_idx" ON "Alocacao"("contratoId", "dataInicio");
CREATE INDEX "Alocacao_colaboradorId_dataInicio_idx" ON "Alocacao"("colaboradorId", "dataInicio");
CREATE INDEX "Alocacao_contratoItemId_idx" ON "Alocacao"("contratoItemId");

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alocacao" ADD CONSTRAINT "Alocacao_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alocacao" ADD CONSTRAINT "Alocacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alocacao" ADD CONSTRAINT "Alocacao_contratoItemId_fkey" FOREIGN KEY ("contratoItemId") REFERENCES "ContratoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
