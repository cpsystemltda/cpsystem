-- Add complemento + tornar cnaePrincipal opcional na Empresa
ALTER TABLE "Empresa" ADD COLUMN "complemento" TEXT;
ALTER TABLE "Empresa" ALTER COLUMN "cnaePrincipal" DROP NOT NULL;

-- Add cep + complemento nos dados pessoais do Analista
ALTER TABLE "Analista" ADD COLUMN "cep" TEXT;
ALTER TABLE "Analista" ADD COLUMN "complemento" TEXT;
