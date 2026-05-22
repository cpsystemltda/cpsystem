-- Pareceres jurídicos gerados pela IA — persiste resultado pra evitar
-- re-análise e dar histórico por documento.
-- Polimórfico: ataId OU contratoId OU empenhoId (apenas um setado).

CREATE TABLE "ParecerJuridico" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "analise" JSONB NOT NULL,
    "modelo" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "ataId" TEXT,
    "contratoId" TEXT,
    "empenhoId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParecerJuridico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParecerJuridico_ataId_criadoEm_idx" ON "ParecerJuridico"("ataId", "criadoEm");
CREATE INDEX "ParecerJuridico_contratoId_criadoEm_idx" ON "ParecerJuridico"("contratoId", "criadoEm");
CREATE INDEX "ParecerJuridico_empenhoId_criadoEm_idx" ON "ParecerJuridico"("empenhoId", "criadoEm");
CREATE INDEX "ParecerJuridico_criadoPorId_idx" ON "ParecerJuridico"("criadoPorId");

ALTER TABLE "ParecerJuridico"
    ADD CONSTRAINT "ParecerJuridico_ataId_fkey"
    FOREIGN KEY ("ataId") REFERENCES "Ata"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParecerJuridico"
    ADD CONSTRAINT "ParecerJuridico_contratoId_fkey"
    FOREIGN KEY ("contratoId") REFERENCES "Contrato"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParecerJuridico"
    ADD CONSTRAINT "ParecerJuridico_empenhoId_fkey"
    FOREIGN KEY ("empenhoId") REFERENCES "Empenho"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParecerJuridico"
    ADD CONSTRAINT "ParecerJuridico_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
