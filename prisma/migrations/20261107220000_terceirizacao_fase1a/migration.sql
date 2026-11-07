-- AlterEnum
ALTER TYPE "TipoObjeto" ADD VALUE 'SERVICOS_PREDOMINANCIA_MAO_DE_OBRA';

-- CreateEnum
CREATE TYPE "RegimeLegal" AS ENUM ('LEI_8666', 'LEI_14133', 'LEI_13303', 'OUTRO');

-- CreateEnum
CREATE TYPE "TermoInicialPagamento" AS ENUM ('ATESTE_NF', 'RECEBIMENTO_NF', 'OUTRO');

-- CreateEnum
CREATE TYPE "UnidadeMaoDeObra" AS ENUM ('POSTO', 'EMPREGADO');

-- CreateEnum
CREATE TYPE "CicloCompetencia" AS ENUM ('MES_CIVIL', 'ANIVERSARIO');

-- CreateEnum
CREATE TYPE "CriterioProRata" AS ENUM ('DIAS_CORRIDOS', 'MES_COMERCIAL');

-- AlterTable
ALTER TABLE "Contrato" ADD COLUMN     "regimeLegal" "RegimeLegal",
ADD COLUMN     "regimeLegalOutro" TEXT,
ADD COLUMN     "regimeSugerido" "RegimeLegal",
ADD COLUMN     "regimeSugeridoTrecho" TEXT,
ADD COLUMN     "regimeConfirmadoEm" TIMESTAMP(3),
ADD COLUMN     "inicioContagemLimite" TIMESTAMP(3),
ADD COLUMN     "limiteProrrogacaoMeses" INTEGER,
ADD COLUMN     "inicioPrestacaoServicos" TIMESTAMP(3),
ADD COLUMN     "diaFechamentoCompetencia" INTEGER,
ADD COLUMN     "termoInicialPagamento" "TermoInicialPagamento",
ADD COLUMN     "termoInicialPagamentoOutro" TEXT,
ADD COLUMN     "valoresMensaisConfirmadosEm" TIMESTAMP(3),
ADD COLUMN     "cicloCompetencia" "CicloCompetencia",
ADD COLUMN     "criterioProRata" "CriterioProRata";

-- AlterTable
ALTER TABLE "ContratoItem" ADD COLUMN     "cbo" TEXT,
ADD COLUMN     "unidadeMaoDeObra" "UnidadeMaoDeObra",
ADD COLUMN     "jornada" TEXT,
ADD COLUMN     "localPrestacao" TEXT,
ADD COLUMN     "colaboradoresPorPosto" INTEGER;
