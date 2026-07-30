-- Cortesia de conciliacao bancaria pra planos BASICO. Regina 30/07:
-- 1o beneficiado foi Leo Santos (leosantosbbb@gmail.com) — 30 dias.
ALTER TABLE "Conta"
  ADD COLUMN "conciliacaoCortesiaAte" TIMESTAMP(3);
