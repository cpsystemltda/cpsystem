import { prisma } from "@/lib/prisma";
async function main() {
  const cols = await prisma.$queryRawUnsafe<Array<{ t: string; c: string }>>(`
    SELECT table_name::text AS t, column_name::text AS c
    FROM information_schema.columns
    WHERE table_schema='public' AND data_type IN ('text','character varying')
  `);
  const comUrl: Array<{ t: string; c: string; n: number }> = [];
  for (const { t, c } of cols) {
    try {
      const r = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*)::bigint AS n FROM "${t}" WHERE "${c}" LIKE '%blob.vercel-storage.com%'`);
      const n = Number(r[0].n);
      if (n > 0) comUrl.push({ t, c, n });
    } catch { /* coluna nao textual util */ }
  }
  comUrl.sort((a,b)=>b.n-a.n);
  console.log("COLUNAS COM URL DE ARQUIVO:");
  let total = 0;
  for (const x of comUrl) { console.log(`  ${x.t}.${x.c}: ${x.n}`); total += x.n; }
  console.log("total de referencias:", total);
}
main().finally(() => prisma.$disconnect());
