-- Regina 13/07: bump de versao do contrato forca re-aceite. Como agora sao 2
-- contratos separados (empresa v2.2, analista v1.0), gravamos qual versao foi
-- aceita pra saber quando pedir novo aceite.
ALTER TABLE "Conta" ADD COLUMN "termosAceitosVersao" TEXT;
