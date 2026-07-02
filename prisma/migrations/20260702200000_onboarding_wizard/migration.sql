-- Wizard de onboarding (Regina 02/07). Contas migradas ou cadastros
-- incompletos precisam completar dados pessoais antes de acessar.
-- dataNascimento tambem serve pra CP System enviar mensagem de
-- aniversario automatica.

ALTER TABLE "Usuario" ADD COLUMN "cpf" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "cargo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "dataNascimento" TIMESTAMP(3);
ALTER TABLE "Usuario" ADD COLUMN "onboardingConcluido" BOOLEAN NOT NULL DEFAULT true;

-- Novo tipo de notificacao WhatsApp: aniversario
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE 'ANIVERSARIO';
