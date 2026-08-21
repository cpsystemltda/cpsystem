import { PrismaClient } from "@/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";

// WebSocket em vez de TCP — elimina handshake TCP (~100ms→~5ms por conexão serverless)
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * O adapter do Neon só fala o protocolo serverless do Neon — apontar a
 * DATABASE_URL pra um Postgres comum não dá erro claro, o cliente só não
 * conecta. Isso travava qualquer teste local de verdade: sem banco, a única
 * alternativa era exercitar o codigo contra a base de producao.
 *
 * Agora a escolha do adapter segue a URL: host `.neon.tech` usa o adapter do
 * Neon (producao e preview), qualquer outro host usa o driver pg normal. Como
 * producao sempre aponta pro Neon, o caminho de producao continua exatamente o
 * mesmo — o ramo novo só existe pra Postgres local.
 */
function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const ehNeon = connectionString.includes("neon.tech");
  const adapter = ehNeon
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
