-- ESP-010 (Igor 07/11/2026): registro das gerações do dossiê da competência.
CREATE TABLE "DossieCompetencia" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "formato" TEXT NOT NULL,
    "incompleto" BOOLEAN NOT NULL DEFAULT false,
    "pendencias" JSONB,
    "colaboradores" INTEGER NOT NULL DEFAULT 0,
    "anexos" INTEGER NOT NULL DEFAULT 0,
    "geradoPorId" TEXT,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DossieCompetencia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DossieCompetencia_competenciaId_geradoEm_idx" ON "DossieCompetencia"("competenciaId", "geradoEm");
ALTER TABLE "DossieCompetencia" ADD CONSTRAINT "DossieCompetencia_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "Competencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
