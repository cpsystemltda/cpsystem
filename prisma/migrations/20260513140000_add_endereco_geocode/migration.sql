-- CreateTable: cache de geocodificação por endereço (entregas, sem CNPJ).
CREATE TABLE "EnderecoGeocode" (
    "endereco" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnderecoGeocode_pkey" PRIMARY KEY ("endereco")
);
