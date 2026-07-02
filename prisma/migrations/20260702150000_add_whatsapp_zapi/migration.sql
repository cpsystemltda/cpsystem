-- Notificacoes WhatsApp via Z-API (Regina 02/07).
-- Usuario ganha campos de opt-in + telefone. Tabela nova NotificacaoWhatsApp
-- rastreia envios (idempotencia + auditoria).

ALTER TABLE "Usuario" ADD COLUMN "telefoneWhatsApp" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "optInWhatsApp" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "TipoNotificacaoWhatsApp" AS ENUM (
  'VENCIMENTO_EMPENHO',
  'ENTREGA_HOJE',
  'ENTREGA_AMANHA',
  'VENCIMENTO_PLANO',
  'PLANO_ATRASADO',
  'RELATORIO_SEMANAL',
  'TESTE_MANUAL'
);

CREATE TYPE "StatusNotificacaoWhatsApp" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHOU');

CREATE TABLE "NotificacaoWhatsApp" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tipo" "TipoNotificacaoWhatsApp" NOT NULL,
  "referenciaId" TEXT,
  "telefone" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "status" "StatusNotificacaoWhatsApp" NOT NULL DEFAULT 'PENDENTE',
  "enviadaEm" TIMESTAMP(3),
  "erro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificacaoWhatsApp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificacaoWhatsApp_usuarioId_tipo_referenciaId_key"
  ON "NotificacaoWhatsApp"("usuarioId", "tipo", "referenciaId");
CREATE INDEX "NotificacaoWhatsApp_usuarioId_criadoEm_idx"
  ON "NotificacaoWhatsApp"("usuarioId", "criadoEm");
CREATE INDEX "NotificacaoWhatsApp_status_idx"
  ON "NotificacaoWhatsApp"("status");

ALTER TABLE "NotificacaoWhatsApp" ADD CONSTRAINT "NotificacaoWhatsApp_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
