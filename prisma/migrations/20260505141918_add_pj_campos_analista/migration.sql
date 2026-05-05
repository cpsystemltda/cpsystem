-- AlterTable
ALTER TABLE "Analista" ADD COLUMN     "cnaePrincipal" TEXT,
ADD COLUMN     "cnaesSecundarios" TEXT,
ADD COLUMN     "emailPj" TEXT,
ADD COLUMN     "enderecoPj" TEXT,
ADD COLUMN     "naturezaJuridica" TEXT,
ADD COLUMN     "porte" "PorteEmpresa",
ADD COLUMN     "telefonePj" TEXT;
