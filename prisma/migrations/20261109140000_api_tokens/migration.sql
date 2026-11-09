-- API pública do CP System (pedido do Léo, 06/11/2026): tokens por conta.
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "escopos" TEXT[],
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMP(3),
    "ultimoIp" TEXT,
    "usos" INTEGER NOT NULL DEFAULT 0,
    "revogadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),
    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApiToken_hash_key" ON "ApiToken"("hash");
CREATE INDEX "ApiToken_contaId_idx" ON "ApiToken"("contaId");
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
