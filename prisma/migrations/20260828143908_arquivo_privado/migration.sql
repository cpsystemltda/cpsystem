-- CreateTable
CREATE TABLE "Arquivo" (
    "id" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoAcessoEm" TIMESTAMP(3),

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Arquivo_pathname_key" ON "Arquivo"("pathname");

-- CreateIndex
CREATE INDEX "Arquivo_contaId_criadoEm_idx" ON "Arquivo"("contaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
