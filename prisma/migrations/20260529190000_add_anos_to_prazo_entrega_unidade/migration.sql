-- Adiciona ANOS ao enum PrazoEntregaUnidade.
-- Usado em vigencia/prazo de entrega de Ata, Contrato, Empenho e Termo Aditivo.
-- ALTER TYPE ADD VALUE precisa ficar isolado de queries que usem o novo valor.
ALTER TYPE "PrazoEntregaUnidade" ADD VALUE IF NOT EXISTS 'ANOS';
