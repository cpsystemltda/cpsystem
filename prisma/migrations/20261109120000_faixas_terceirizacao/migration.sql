-- ESP-011 (Igor 07/11/2026): liberação do módulo e apuração por faixa de colaboradores.
ALTER TYPE "TipoNotificacaoWhatsApp" ADD VALUE 'TERCEIRIZACAO_FAIXA';
ALTER TABLE "Conta" ADD COLUMN "terceirizacaoPerdidaEm" TIMESTAMP(3);
CREATE TABLE "ApuracaoColaboradoresMes" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "pico" INTEGER NOT NULL DEFAULT 0,
    "picoEm" TIMESTAMP(3),
    "ultimoValor" INTEGER NOT NULL DEFAULT 0,
    "faixaIndice" INTEGER NOT NULL DEFAULT 0,
    "faixaValor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aviso90Em" TIMESTAMP(3),
    "mudancaFaixaAvisadaIndice" INTEGER,
    "cobradoEm" TIMESTAMP(3),
    "cobrancaRef" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApuracaoColaboradoresMes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApuracaoColaboradoresMes_contaId_competencia_key" ON "ApuracaoColaboradoresMes"("contaId", "competencia");
ALTER TABLE "ApuracaoColaboradoresMes" ADD CONSTRAINT "ApuracaoColaboradoresMes_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
