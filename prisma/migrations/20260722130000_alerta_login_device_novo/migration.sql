-- SEG P1: alerta de login em dispositivo novo (Regina 22/07/2026)
CREATE TABLE "DispositivoConhecido" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ipUltimoAcesso" TEXT,
    "userAgentAmostra" TEXT,
    "primeiroLoginEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoLoginEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispositivoConhecido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DispositivoConhecido_usuarioId_fingerprint_key" ON "DispositivoConhecido"("usuarioId", "fingerprint");
CREATE INDEX "DispositivoConhecido_usuarioId_idx" ON "DispositivoConhecido"("usuarioId");

ALTER TABLE "DispositivoConhecido" ADD CONSTRAINT "DispositivoConhecido_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
