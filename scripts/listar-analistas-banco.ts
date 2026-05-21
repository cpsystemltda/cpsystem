/**
 * Lista TODOS os analistas cadastrados no banco — pra Regina identificar
 * os de teste vs o real (Igor) antes de apagar.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/listar-analistas-banco.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const analistas = await prisma.analista.findMany({
    include: {
      conta: {
        select: {
          id: true,
          criadoEm: true,
          usuarios: { select: { email: true, superAdmin: true } },
        },
      },
      vinculos: { select: { id: true } },
      comissoes: { select: { id: true } },
      _count: { select: { contasIndicadas: true } },
    },
    orderBy: { criadoEm: "asc" },
  });

  console.log(`\n=== ${analistas.length} analistas cadastrados ===\n`);
  for (const a of analistas) {
    const emails = a.conta?.usuarios.map((u) => u.email).join(", ") ?? "(sem conta)";
    const ehAdmin = a.conta?.usuarios.some((u) => u.superAdmin) ? " · SUPER ADMIN" : "";
    console.log(`▸ ${a.nomeCompleto}${ehAdmin}`);
    console.log(`  Analista ID: ${a.id}`);
    console.log(`  Conta ID:    ${a.conta?.id ?? "(nenhuma)"}`);
    console.log(`  E-mail:      ${emails}`);
    console.log(`  CPF:         ${a.cpf}`);
    console.log(`  Criado em:   ${a.criadoEm.toLocaleString("pt-BR")}`);
    console.log(`  Vínculos:    ${a.vinculos.length}`);
    console.log(`  Comissões:   ${a.comissoes.length}`);
    console.log(`  Indicações:  ${a._count.contasIndicadas}`);
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
