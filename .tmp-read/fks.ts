import { prisma } from "@/lib/prisma";
async function main() {
  const alvos = ["ComissaoExecucao_analistaId_fkey","ComissaoExecucao_empenhoId_fkey","ComissaoExecucao_vinculoId_fkey",
    "Conciliacao_transacaoId_fkey","Extrato_contaId_fkey","TransacaoExtrato_extratoId_fkey"];
  const r = await prisma.$queryRawUnsafe<Array<{ conname: string; confdeltype: string; tabela: string }>>(`
    SELECT c.conname::text AS conname, c.confdeltype::text AS confdeltype, cl.relname::text AS tabela
    FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid
    WHERE c.contype = 'f' AND c.conname = ANY($1::text[])
  `, alvos);
  const nome: Record<string,string> = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT" };
  console.log("== chaves estrangeiras em PRODUCAO ==");
  for (const x of r) console.log(`  ${x.conname.padEnd(38)} -> ON DELETE ${nome[x.confdeltype]}`);
  const idx = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname::text AS indexname FROM pg_indexes WHERE indexname = 'Conta_cupomAplicadoId_idx'`);
  console.log("\nIndice Conta_cupomAplicadoId_idx existe em prod?", idx.length > 0 ? "SIM" : "nao");
  // quantas linhas nas tabelas afetadas — pra dimensionar risco
  for (const t of ["ComissaoExecucao","Extrato","TransacaoExtrato","Conciliacao"]) {
    const n = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(`SELECT count(*)::bigint AS c FROM "${t}"`);
    console.log(`  ${t}: ${n[0].c} linha(s)`);
  }
}
main().finally(() => prisma.$disconnect());
