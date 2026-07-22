-- SEG P1: 2FA TOTP opt-in (Regina 22/07/2026)

ALTER TABLE "Usuario"
  ADD COLUMN "totpSecret" TEXT,
  ADD COLUMN "totpAtivadoEm" TIMESTAMP(3);

CREATE TABLE "RecoveryCode2FA" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode2FA_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecoveryCode2FA_usuarioId_idx" ON "RecoveryCode2FA"("usuarioId");

ALTER TABLE "RecoveryCode2FA" ADD CONSTRAINT "RecoveryCode2FA_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
