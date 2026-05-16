-- Adiciona modo SOB_DEMANDA ao enum PrazoEntregaModo.
-- Caso de uso: contratos cuja data de entrega/execução só é conhecida
-- depois (sob demanda). Quando selecionado, prazo/data ficam em branco.
ALTER TYPE "PrazoEntregaModo" ADD VALUE IF NOT EXISTS 'SOB_DEMANDA';
