-- EventoGoogleCalendar — suporta sync pra multiplos calendars (criador + analistas vinculados).
-- Regina 23/07/2026.

CREATE TABLE "EventoGoogleCalendar" (
    "id" TEXT NOT NULL,
    "googleAccountId" TEXT NOT NULL,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoGoogleCalendar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoGoogleCalendar_googleAccountId_entidadeTipo_entidadeId_key"
  ON "EventoGoogleCalendar"("googleAccountId", "entidadeTipo", "entidadeId");
CREATE INDEX "EventoGoogleCalendar_entidadeTipo_entidadeId_idx"
  ON "EventoGoogleCalendar"("entidadeTipo", "entidadeId");

ALTER TABLE "EventoGoogleCalendar" ADD CONSTRAINT "EventoGoogleCalendar_googleAccountId_fkey"
  FOREIGN KEY ("googleAccountId") REFERENCES "GoogleAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
