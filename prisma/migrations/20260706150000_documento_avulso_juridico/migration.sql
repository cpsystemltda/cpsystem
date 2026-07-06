-- Documento avulso (PDF) submetido pelo usuário pra análise jurídica.
-- Suporta TC (Termo de Cooperação), minutas, aditivos e qualquer PDF
-- que não é modelado como entidade própria no sistema.
-- Regina 06/07/2026.
CREATE TABLE "DocumentoAvulsoJuridico" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "blobPathname" TEXT,
    "tamanhoBytes" INTEGER,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoAvulsoJuridico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentoAvulsoJuridico_empresaId_criadoEm_idx" ON "DocumentoAvulsoJuridico"("empresaId", "criadoEm");
CREATE INDEX "DocumentoAvulsoJuridico_criadoPorId_idx" ON "DocumentoAvulsoJuridico"("criadoPorId");

ALTER TABLE "DocumentoAvulsoJuridico" ADD CONSTRAINT "DocumentoAvulsoJuridico_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentoAvulsoJuridico" ADD CONSTRAINT "DocumentoAvulsoJuridico_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Parecer pode agora ser sobre um DocumentoAvulsoJuridico
ALTER TABLE "ParecerJuridico" ADD COLUMN "avulsoId" TEXT;
CREATE INDEX "ParecerJuridico_avulsoId_criadoEm_idx" ON "ParecerJuridico"("avulsoId", "criadoEm");
ALTER TABLE "ParecerJuridico" ADD CONSTRAINT "ParecerJuridico_avulsoId_fkey"
    FOREIGN KEY ("avulsoId") REFERENCES "DocumentoAvulsoJuridico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
