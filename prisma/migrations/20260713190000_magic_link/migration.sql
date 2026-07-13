-- Regina 13/07: login sem senha via link unico enviado por WA (Leo migracao).
CREATE TABLE "MagicLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoPor" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MagicLink_token_key" ON "MagicLink"("token");
CREATE INDEX "MagicLink_usuarioId_idx" ON "MagicLink"("usuarioId");
CREATE INDEX "MagicLink_expiraEm_idx" ON "MagicLink"("expiraEm");

ALTER TABLE "MagicLink" ADD CONSTRAINT "MagicLink_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
