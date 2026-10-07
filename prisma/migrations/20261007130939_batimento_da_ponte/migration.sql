-- CreateTable
CREATE TABLE "BatimentoPonte" (
    "id" TEXT NOT NULL DEFAULT 'unico',
    "ultimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "levouAgora" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BatimentoPonte_pkey" PRIMARY KEY ("id")
);
