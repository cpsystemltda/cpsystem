/**
 * Valida o cálculo do saldo do Contrato 82/2024 UnB com a nova lógica de
 * matching tolerante de descrição. Saída esperada: para cada item do
 * contrato, qtd contratada × qtd executada (somatório dos empenhos que
 * dão match) × qtd disponível.
 *
 * Se algum item ainda mostrar "0 executado" mesmo havendo empenhos,
 * a normalização precisa ser ampliada.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/validar-saldo-contrato-82.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Mesma função que está em src/lib/saldo.ts
function normalizarDescricao(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;]+$/, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((p) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p))
    .join(" ");
}

async function main() {
  const c = await prisma.contrato.findFirst({
    where: { numero: "82/2024" },
    include: { itens: true, empenhos: { include: { itens: true } } },
  });
  if (!c) return console.log("Contrato 82/2024 não encontrado");

  const empenhoItens = c.empenhos.flatMap((e) =>
    e.itens.map((i) => ({ ...i, empenhoNumero: e.numero })),
  );

  console.log(`Contrato ${c.numero} — total de empenhoItens: ${empenhoItens.length}\n`);

  for (const it of c.itens) {
    const descNorm = normalizarDescricao(it.descricao);
    console.log(`\n=== Item contrato: "${it.descricao}"`);
    console.log(`    Norm: "${descNorm}"  Qtd contratada: ${it.quantidade}`);

    let executado = 0;
    let matchCount = 0;
    let noMatch: string[] = [];

    for (const e of empenhoItens) {
      const eNorm = normalizarDescricao(e.descricao);
      const match =
        (it.ataItemId && e.ataItemId === it.ataItemId) || eNorm === descNorm;
      if (match) {
        executado += e.quantidade;
        matchCount++;
      } else {
        // Detectar candidatos próximos
        if (eNorm.includes(descNorm.split(" ").slice(0, 4).join(" "))) {
          noMatch.push(`"${e.descricao}" (norm: "${eNorm}") — empenho ${e.empenhoNumero}`);
        }
      }
    }

    console.log(`    Executado: ${executado} (${matchCount} empenhoItens)`);
    console.log(`    A executar: ${Math.max(0, it.quantidade - executado)}`);
    if (noMatch.length > 0) {
      console.log(`    ⚠️  ${noMatch.length} empenho(s) parecidos NÃO bateram:`);
      noMatch.forEach((n) => console.log(`         ${n}`));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
