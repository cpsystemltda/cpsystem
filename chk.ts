import { PrismaClient } from "./src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const p = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });
(async () => {
  const cob = await p.cobranca.findFirst({
    where: { gatewayChargeId: "pay_ao3rx1tqoqqsy3o8" },
    select: { nfseNumero: true, nfsePdfUrl: true, nfseStatus: true, nfseEmitidaEm: true },
  });
  console.log("Cobranca R$10:", JSON.stringify(cob, null, 2));

  const evs = await p.eventoGateway.findMany({
    where: { evento: { startsWith: "INVOICE_" } },
    orderBy: { recebidoEm: "desc" },
    take: 5,
  });
  console.log("\nUltimos INVOICE_* recebidos:");
  for (const e of evs) console.log(`  ${e.recebidoEm.toISOString()} ${e.evento}`);
  await p.$disconnect();
})();
