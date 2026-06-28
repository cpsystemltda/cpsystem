-- Horario de execucao no Empenho (Igor 26/06). Pra servicos/locacoes
-- que tem hora marcada — opcionais, formato "HH:MM" 24h. Os empenhos
-- de fornecimento puro nao precisam, ficam NULL.
ALTER TABLE "Empenho" ADD COLUMN "horaInicio" TEXT;
ALTER TABLE "Empenho" ADD COLUMN "horaFim" TEXT;
