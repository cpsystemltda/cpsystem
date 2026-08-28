-- Separa tentativa de LOGIN de tentativa de CADASTRO, pra cada uma ter o
-- proprio limite. Aditivo: linhas existentes ficam como LOGIN.
ALTER TABLE "TentativaLogin" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'LOGIN';
CREATE INDEX "TentativaLogin_ip_tipo_criadoEm_idx" ON "TentativaLogin"("ip", "tipo", "criadoEm");
