-- Acesso por modulo para colaboradores (Regina 21/08, pedido do Leo).
-- Aditiva e com default: usuario existente continua com acesso completo,
-- porque acessoRestrito nasce false. Nenhuma linha e reescrita.
ALTER TABLE "Usuario" ADD COLUMN "acessoRestrito" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN "modulosPermitidos" TEXT[] DEFAULT ARRAY[]::TEXT[];
