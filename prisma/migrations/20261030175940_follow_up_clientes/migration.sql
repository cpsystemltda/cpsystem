-- CreateEnum
CREATE TYPE "ResultadoFollowUp" AS ENUM ('REALIZADO', 'TENTATIVA');

-- CreateEnum
CREATE TYPE "CanalFollowUp" AS ENUM ('WHATSAPP', 'TELEFONE', 'VIDEOCHAMADA', 'EMAIL', 'PRESENCIAL');

-- CreateTable
CREATE TABLE "FollowUpCliente" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "marcoDias" INTEGER NOT NULL,
    "resultado" "ResultadoFollowUp" NOT NULL,
    "canal" "CanalFollowUp" NOT NULL,
    "contatoNome" TEXT,
    "resumo" TEXT NOT NULL,
    "orientacoes" TEXT,
    "feedback" TEXT,
    "diagnostico" JSONB,
    "retornarEm" TIMESTAMP(3),
    "realizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "realizadoPorId" TEXT,
    "realizadoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpCliente_contaId_realizadoEm_idx" ON "FollowUpCliente"("contaId", "realizadoEm");

-- AddForeignKey
ALTER TABLE "FollowUpCliente" ADD CONSTRAINT "FollowUpCliente_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
