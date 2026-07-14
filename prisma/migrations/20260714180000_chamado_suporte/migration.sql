-- Regina 14/07: sistema de suporte com IA respondendo msgs de WhatsApp.
CREATE TYPE "CategoriaChamado" AS ENUM ('DUVIDA_USO', 'AJUSTE_DADOS', 'CORRECAO_OPERACIONAL', 'BUG_SISTEMA', 'FEATURE_PEDIDO', 'OUTRO');
CREATE TYPE "StatusChamado" AS ENUM ('ABERTO', 'IA_ANALISANDO', 'IA_RESOLVEU', 'AGUARDANDO_ADMIN', 'EM_IMPLEMENTACAO', 'RESOLVIDO_ADMIN', 'RECUSADO');

CREATE TABLE "ChamadoSuporte" (
    "id"             TEXT NOT NULL,
    "contaId"        TEXT NOT NULL,
    "usuarioId"      TEXT NOT NULL,
    "categoria"      "CategoriaChamado" NOT NULL DEFAULT 'OUTRO',
    "titulo"         TEXT NOT NULL,
    "descricao"      TEXT NOT NULL,
    "status"         "StatusChamado" NOT NULL DEFAULT 'ABERTO',
    "respostaIA"     TEXT,
    "iaAgiu"         BOOLEAN NOT NULL DEFAULT false,
    "iaAcaoResumo"   TEXT,
    "resolvidoPorId" TEXT,
    "resolvidoEm"    TIMESTAMP(3),
    "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChamadoSuporte_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChamadoSuporte_status_idx" ON "ChamadoSuporte"("status");
CREATE INDEX "ChamadoSuporte_contaId_idx" ON "ChamadoSuporte"("contaId");
CREATE INDEX "ChamadoSuporte_criadoEm_idx" ON "ChamadoSuporte"("criadoEm");

ALTER TABLE "ChamadoSuporte" ADD CONSTRAINT "ChamadoSuporte_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChamadoSuporte" ADD CONSTRAINT "ChamadoSuporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MensagemChamado" (
    "id"        TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "autor"     TEXT NOT NULL,
    "autorId"   TEXT,
    "conteudo"  TEXT NOT NULL,
    "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemChamado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MensagemChamado_chamadoId_idx" ON "MensagemChamado"("chamadoId");
ALTER TABLE "MensagemChamado" ADD CONSTRAINT "MensagemChamado_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "ChamadoSuporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
