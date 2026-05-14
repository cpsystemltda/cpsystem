-- M5 Garantia contratual: tri-estado (null = não declarado, true = há
-- previsão, false = explicitamente sem previsão). Permite registrar
-- "Sem garantia" como decisão consciente do usuário.
ALTER TABLE "Contrato" ADD COLUMN "temGarantia" BOOLEAN;
ALTER TABLE "Empenho"  ADD COLUMN "temGarantia" BOOLEAN;
