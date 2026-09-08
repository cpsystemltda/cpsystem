-- CreateEnum
CREATE TYPE "SituacaoLead" AS ENUM ('NAO_CONTATADO', 'TENTOU_NAO_FALOU', 'FALOU_COM_DECISOR', 'DEMONSTRACAO_MARCADA', 'CLIENTE', 'RETORNAR_DEPOIS', 'NAO_E_CLIENTE', 'NAO_PERTURBAR');

-- CreateTable
CREATE TABLE "LeadProspeccao" (
    "id" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "municipio" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "venceEm" TIMESTAMP(3) NOT NULL,
    "valorDoContrato" DOUBLE PRECISION NOT NULL,
    "orgao" TEXT,
    "objeto" TEXT,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "qtdContratos" INTEGER NOT NULL DEFAULT 1,
    "porte" TEXT,
    "perfil" TEXT,
    "alvoIdeal" BOOLEAN NOT NULL DEFAULT false,
    "situacao" "SituacaoLead" NOT NULL DEFAULT 'NAO_CONTATADO',
    "anotacoes" TEXT,
    "atualizadoPorId" TEXT,
    "atualizadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadProspeccao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadProspeccao_cnpj_key" ON "LeadProspeccao"("cnpj");

-- CreateIndex
CREATE INDEX "LeadProspeccao_situacao_idx" ON "LeadProspeccao"("situacao");

-- CreateIndex
CREATE INDEX "LeadProspeccao_venceEm_idx" ON "LeadProspeccao"("venceEm");
