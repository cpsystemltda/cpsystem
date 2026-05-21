/**
 * Apaga os 7 analistas de teste (CPFs 99999900001..99999900007) deixando
 * apenas o Igor real. Confirmado pela Regina em 2026-05-21.
 *
 * Pré-validação: cada um precisa ter 0 vínculos, 0 comissões e 0 contas
 * indicadas — senão aborta. Os 5 vínculos órfãos da Regina já foram
 * apagados no commit a39aa3d, então os analistas estão limpos.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/apagar-analistas-teste.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CPFS_TESTE = [
  "99999900001", // Carla Mendes Souza
  "99999900002", // Rafael Almeida Castro
  "99999900003", // Juliana Pereira Lima
  "99999900004", // Marcos Antunes Silva
  "99999900005", // Beatriz Oliveira Rocha
  "99999900006", // Pedro Henrique Costa
  "99999900007", // Larissa Fonseca Dias
];

async function main() {
  const alvos = await prisma.analista.findMany({
    where: { cpf: { in: CPFS_TESTE } },
    include: {
      vinculos: { select: { id: true } },
      comissoes: { select: { id: true } },
      _count: { select: { contasIndicadas: true } },
    },
  });

  console.log(`\nAnalistas alvo: ${alvos.length}\n`);
  for (const a of alvos) {
    console.log(`▸ ${a.nomeCompleto} (CPF ${a.cpf})`);
    console.log(`  Vínculos: ${a.vinculos.length} · Comissões: ${a.comissoes.length} · Indicações: ${a._count.contasIndicadas}`);
  }

  // Pré-validação: bloquear se houver dependências
  const comDep = alvos.filter((a) => a.vinculos.length > 0 || a.comissoes.length > 0 || a._count.contasIndicadas > 0);
  if (comDep.length > 0) {
    console.log("\n⚠️  Os seguintes analistas têm dependências e não podem ser apagados:");
    for (const a of comDep) console.log(`  - ${a.nomeCompleto}`);
    process.exit(1);
  }

  console.log("\nExecutando deleção...");
  const r = await prisma.analista.deleteMany({ where: { cpf: { in: CPFS_TESTE } } });
  console.log(`✓ ${r.count} analistas apagados.`);

  // Confirma que só Igor sobrou
  const restantes = await prisma.analista.findMany({
    select: { nomeCompleto: true, cpf: true },
    orderBy: { criadoEm: "asc" },
  });
  console.log(`\nAnalistas restantes (${restantes.length}):`);
  for (const r of restantes) console.log(`  ▸ ${r.nomeCompleto} (CPF ${r.cpf})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
