-- Integracao Google Calendar (Igor 26/06).
-- GoogleAccount: 1 conta Google por usuario do CP System.
-- Empenho.googleEventId: rastreia evento sincronizado pra UPDATE/DELETE.

CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "calendarId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleAccount_usuarioId_key" ON "GoogleAccount"("usuarioId");

ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Empenho" ADD COLUMN "googleEventId" TEXT;
