import { sincronizarNotasDoMes } from "./src/lib/portal/sincronizar";
import { prisma } from "./src/lib/prisma";

async function main() {
  console.log("sincronizando notas de setembro/2026 contra o banco de TESTE…");
  const t0 = Date.now();
  const r = await sincronizarNotasDoMes(new Date("2026-09-15T12:00:00-03:00"));
  console.log(`\nempresas com acesso : ${r.empresas}`);
  console.log(`linhas lidas        : ${r.linhasLidas.toLocaleString("pt-BR")}`);
  console.log(`notas gravadas      : ${r.notasGravadas}`);
  console.log(`casadas com as nossas: ${r.notasCasadas}`);
  console.log(`tempo               : ${((Date.now()-t0)/1000).toFixed(1)}s`);

  const amostra = await prisma.notaFiscalPortal.findMany({
    take: 4, orderBy: { dataEmissao: "asc" },
    select: { numero: true, serie: true, valor: true, dataEmissao: true, orgaoDestinatario: true, ultimoEvento: true, notaFiscalId: true },
  });
  console.log("\namostra gravada:");
  for (const n of amostra) {
    console.log(`  NF ${n.numero}/${n.serie}  R$ ${n.valor.toLocaleString("pt-BR",{minimumFractionDigits:2})}  ${n.dataEmissao.toLocaleDateString("pt-BR",{timeZone:"UTC"})}  → ${n.orgaoDestinatario}  [${n.ultimoEvento}]`);
  }
  const total = await prisma.notaFiscalPortal.aggregate({ _count: true, _sum: { valor: true } });
  console.log(`\nTOTAL no banco: ${total._count} notas · R$ ${(total._sum.valor ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALHOU:", e); process.exit(1); });
