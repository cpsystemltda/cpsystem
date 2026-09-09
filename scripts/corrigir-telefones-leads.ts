import "./_env";
import { prisma } from "@/lib/prisma";

/**
 * Conserta os telefones da base de prospecção.
 *
 * Regina 08/09: "os números de telefone parecem totalmente desconfigurados, tem
 * que ver isso pra ela conseguir o contato".
 *
 * Eram dois problemas, e o segundo é o grave:
 *
 *   1. FORMATO. O cadastro da Receita devolve "5432243800". O DDD está lá, só
 *      não está separado — e ninguém disca olhando pra isso.
 *
 *   2. NONO DÍGITO FALTANDO. 192 dos 552 são celulares cadastrados antes de
 *      2016, quando o país ainda usava 8 dígitos. Hoje esses números
 *      simplesmente NÃO COMPLETAM a ligação. Mais de um terço da lista era
 *      telefone morto, e isso só apareceria depois de a closer perder a manhã
 *      ouvindo "número inexistente".
 *
 * Regra: depois do DDD, número começando em 2-5 é fixo (8 dígitos, correto);
 * começando em 6-9 é celular e precisa do 9 na frente.
 */
function arrumar(bruto: string | null): { numero: string; mudou: boolean } | null {
  const d = (bruto || "").replace(/\D/g, "");
  if (!d) return null;

  // Alguns vêm com o 55 do país na frente.
  const sem55 = d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
  if (sem55.length < 10 || sem55.length > 11) return null;

  const ddd = sem55.slice(0, 2);
  let n = sem55.slice(2);

  // Celular antigo de 8 dígitos: ganha o nono.
  if (n.length === 8 && /^[6-9]/.test(n)) n = `9${n}`;

  const formatado =
    n.length === 9 ? `(${ddd}) ${n.slice(0, 5)}-${n.slice(5)}` : `(${ddd}) ${n.slice(0, 4)}-${n.slice(4)}`;

  return { numero: formatado, mudou: formatado !== (bruto || "") };
}

async function main() {
  const leads = await prisma.leadProspeccao.findMany({ select: { id: true, telefone: true, empresa: true } });

  let corrigidos = 0, noveAdicionado = 0, semArrumar = 0, jaOk = 0;

  for (const l of leads) {
    const antes = (l.telefone || "").replace(/\D/g, "");
    const r = arrumar(l.telefone);
    if (!r) { semArrumar++; continue; }
    if (!r.mudou) { jaOk++; continue; }

    const depois = r.numero.replace(/\D/g, "");
    if (depois.length > antes.length) noveAdicionado++;

    await prisma.leadProspeccao.update({ where: { id: l.id }, data: { telefone: r.numero } });
    corrigidos++;
  }

  console.log(`Leads: ${leads.length}`);
  console.log(`  corrigidos:                 ${corrigidos}`);
  console.log(`  destes, com nono dígito:    ${noveAdicionado}  ← não completavam a ligação`);
  console.log(`  já estavam certos:          ${jaOk}`);
  console.log(`  sem telefone utilizável:    ${semArrumar}`);

  const amostra = await prisma.leadProspeccao.findMany({
    select: { empresa: true, telefone: true },
    orderBy: { venceEm: "asc" },
    take: 8,
  });
  console.log("\nComo ficou:");
  for (const a of amostra) console.log(`  ${(a.telefone ?? "—").padEnd(18)} ${a.empresa.slice(0, 38)}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
