-- Conciliacao Bancaria (Regina 21/07/2026)
-- Feature INTERMEDIARIO+PREMIUM. Cliente sobe PDF do extrato -> LLM extrai
-- transacoes -> matcheia com empenhos abertos -> gera dashboard.

-- 1) Novos campos em Conta
ALTER TABLE "Conta"
  ADD COLUMN "conciliacaoDiaMes" INTEGER,
  ADD COLUMN "conciliacaoOptIn" BOOLEAN NOT NULL DEFAULT true;

-- 2) Enums novos
CREATE TYPE "FonteExtrato" AS ENUM ('WEB_UPLOAD', 'WHATSAPP_INBOUND', 'MANUAL_ADMIN');
CREATE TYPE "StatusProcessamentoExtrato" AS ENUM ('RECEBIDO', 'EXTRAINDO', 'EXTRAIDO', 'CONCILIANDO', 'CONCLUIDO', 'ERRO');
CREATE TYPE "TipoTransacao" AS ENUM ('CREDITO', 'DEBITO');
CREATE TYPE "StatusConciliacao" AS ENUM ('SUGERIDA', 'CONFIRMADA', 'REJEITADA');

-- 3) Tabela Extrato
CREATE TABLE "Extrato" (
  "id" TEXT PRIMARY KEY,
  "contaId" TEXT NOT NULL,
  "fonte" "FonteExtrato" NOT NULL,
  "status" "StatusProcessamentoExtrato" NOT NULL DEFAULT 'RECEBIDO',
  "hashArquivo" TEXT NOT NULL,
  "nomeArquivo" TEXT NOT NULL,
  "tamanhoBytes" INTEGER NOT NULL,
  "urlArquivo" TEXT,
  "bancoDetectado" TEXT,
  "agenciaConta" TEXT,
  "periodoInicio" TIMESTAMP(3),
  "periodoFim" TIMESTAMP(3),
  "saldoInicial" DOUBLE PRECISION,
  "saldoFinal" DOUBLE PRECISION,
  "totalTransacoes" INTEGER NOT NULL DEFAULT 0,
  "totalCreditos" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalDebitos" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "qtdMatchAlto" INTEGER NOT NULL DEFAULT 0,
  "qtdMatchMedio" INTEGER NOT NULL DEFAULT 0,
  "qtdSemMatch" INTEGER NOT NULL DEFAULT 0,
  "erroMsg" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Extrato_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "Extrato_contaId_hashArquivo_key" ON "Extrato"("contaId", "hashArquivo");
CREATE INDEX "Extrato_contaId_status_idx" ON "Extrato"("contaId", "status");

-- 4) Tabela TransacaoExtrato
CREATE TABLE "TransacaoExtrato" (
  "id" TEXT PRIMARY KEY,
  "extratoId" TEXT NOT NULL,
  "tipo" "TipoTransacao" NOT NULL,
  "data" TIMESTAMP(3) NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "descricao" TEXT NOT NULL,
  "nomeContraparte" TEXT,
  "cnpjContraparte" TEXT,
  "identificadorBancario" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransacaoExtrato_extratoId_fkey" FOREIGN KEY ("extratoId") REFERENCES "Extrato"("id") ON DELETE CASCADE
);
CREATE INDEX "TransacaoExtrato_extratoId_tipo_idx" ON "TransacaoExtrato"("extratoId", "tipo");

-- 5) Tabela Conciliacao (vinculo transacao <-> empenho)
CREATE TABLE "Conciliacao" (
  "id" TEXT PRIMARY KEY,
  "transacaoId" TEXT NOT NULL,
  "empenhoId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "fatoresMatch" JSONB,
  "status" "StatusConciliacao" NOT NULL DEFAULT 'SUGERIDA',
  "confirmadaEm" TIMESTAMP(3),
  "confirmadaPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conciliacao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoExtrato"("id") ON DELETE CASCADE
);
CREATE INDEX "Conciliacao_transacaoId_idx" ON "Conciliacao"("transacaoId");
CREATE INDEX "Conciliacao_empenhoId_idx" ON "Conciliacao"("empenhoId");
