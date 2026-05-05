import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const counts = {
    conta: await p.conta.count(),
    usuario: await p.usuario.count(),
    empresa: await p.empresa.count(),
    contrato: await p.contrato.count(),
    ata: await p.ata.count(),
    empenho: await p.empenho.count(),
    termoAditivo: await p.termoAditivo.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
