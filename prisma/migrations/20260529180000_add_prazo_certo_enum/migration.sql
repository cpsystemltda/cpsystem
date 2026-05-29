-- Adiciona PRAZO_CERTO ao enum PrazoEntregaModo.
-- ALTER TYPE ... ADD VALUE precisa ficar isolado de queries que usem o
-- novo valor — por isso esta migration so altera o enum; as colunas
-- novas (dataEntregaInicio/Fim) ficam na migration seguinte.
ALTER TYPE "PrazoEntregaModo" ADD VALUE IF NOT EXISTS 'PRAZO_CERTO';
