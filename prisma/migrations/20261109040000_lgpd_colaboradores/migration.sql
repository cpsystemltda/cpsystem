-- ESP-007 (Igor 07/11/2026): segurança e LGPD para dados de colaboradores.

-- AlterEnum
ALTER TYPE "PerfilUsuario" ADD VALUE 'RH_CONTRATO';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'ACESSO';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "permissaoDadosColaboradores" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conta"
  ADD COLUMN "retencaoDadosColaboradoresAnos" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "adendoLgpdVersao" TEXT;

-- CreateTable
CREATE TABLE "AceiteAdendoLgpd" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "versao" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AceiteAdendoLgpd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AceiteAdendoLgpd_contaId_versao_idx" ON "AceiteAdendoLgpd"("contaId", "versao");

-- AddForeignKey
ALTER TABLE "AceiteAdendoLgpd" ADD CONSTRAINT "AceiteAdendoLgpd_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
