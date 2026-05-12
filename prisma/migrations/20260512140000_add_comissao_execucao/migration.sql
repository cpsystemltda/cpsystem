-- ComissaoExecucao (Linha B): a comissão que a empresa precisa pagar ao
-- analista, separada do pagamento do órgão à empresa (Empenho.status === PAGO).
-- Corrige o bug que misturava os dois eventos: agora Empenho.status PAGO indica
-- apenas Linha A (órgão→empresa); o estado de Linha B vive aqui.

CREATE TYPE "StatusComissaoExecucao" AS ENUM (
  'AGUARDANDO_ORGAO',
  'A_RECEBER',
  'ATRASADO',
  'PAGO',
  'PAGO_PARCIAL'
);

CREATE TABLE "ComissaoExecucao" (
  "id"                  TEXT PRIMARY KEY,
  "empenhoId"           TEXT NOT NULL,
  "vinculoId"           TEXT NOT NULL,
  "analistaId"          TEXT NOT NULL,

  "percentual"          DOUBLE PRECISION NOT NULL,
  "percentualOverride"  BOOLEAN NOT NULL DEFAULT false,
  "observacaoOverride"  TEXT,

  "valorBaseEmpenho"    DOUBLE PRECISION NOT NULL,
  "valorBasePago"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorCalculado"      DOUBLE PRECISION NOT NULL,
  "valorRecebido"       DOUBLE PRECISION NOT NULL DEFAULT 0,

  "status"              "StatusComissaoExecucao" NOT NULL DEFAULT 'AGUARDANDO_ORGAO',
  "dataPagamento"       TIMESTAMP(3),
  "comprovanteUrl"      TEXT,
  "observacao"          TEXT,

  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ComissaoExecucao_empenhoId_fkey"  FOREIGN KEY ("empenhoId")  REFERENCES "Empenho"("id")  ON DELETE CASCADE,
  CONSTRAINT "ComissaoExecucao_vinculoId_fkey"  FOREIGN KEY ("vinculoId")  REFERENCES "VinculoAnalista"("id") ON DELETE CASCADE,
  CONSTRAINT "ComissaoExecucao_analistaId_fkey" FOREIGN KEY ("analistaId") REFERENCES "Analista"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ComissaoExecucao_empenhoId_vinculoId_key"
  ON "ComissaoExecucao"("empenhoId", "vinculoId");
CREATE INDEX "ComissaoExecucao_analistaId_status_idx" ON "ComissaoExecucao"("analistaId", "status");
CREATE INDEX "ComissaoExecucao_vinculoId_idx" ON "ComissaoExecucao"("vinculoId");
CREATE INDEX "ComissaoExecucao_empenhoId_idx" ON "ComissaoExecucao"("empenhoId");
