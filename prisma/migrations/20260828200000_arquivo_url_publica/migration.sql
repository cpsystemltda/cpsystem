-- Fallback pra quando o store de arquivos nao aceitar objeto privado.
ALTER TABLE "Arquivo" ADD COLUMN "urlPublica" TEXT;
