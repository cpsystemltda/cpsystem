-- AlterTable Empenho: prazo de entrega ganha modo (RELATIVO/DATA_CERTA) +
-- data certa opcional. Enum PrazoEntregaModo já existe (criado pelo
-- Contrato em migration anterior). Default RELATIVO mantém retrocompat.
ALTER TABLE "Empenho"
  ADD COLUMN "prazoEntregaModo" "PrazoEntregaModo" NOT NULL DEFAULT 'RELATIVO',
  ADD COLUMN "dataEntregaCerta" TIMESTAMP(3);

-- procedimentoSelecao vira opcional pro Empenho (M3.3, Igor).
-- Empenhos antigos têm valor preenchido — continua até alguém editar.
ALTER TABLE "Empenho" ALTER COLUMN "procedimentoSelecao" DROP NOT NULL;
