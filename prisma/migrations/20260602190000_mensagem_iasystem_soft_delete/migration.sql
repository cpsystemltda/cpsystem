-- Soft delete em MensagemIAsystem — preserva contagem de cota diaria
-- do plano Basico (2 perguntas/dia) mesmo apos 'Limpar historico'.
ALTER TABLE "MensagemIAsystem" ADD COLUMN "deletadaEm" TIMESTAMP(3);
