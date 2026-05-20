/**
 * Backfill da vigência de Garantias com base nos endossos existentes.
 *
 * Por que: o bug do Contrato 82/2024 UNB era que `adicionarEndossoAction`
 * não propagava `endosso.dataFim` para `Garantia.dataFim`. Após o fix, novos
 * endossos atualizam corretamente, mas os endossos JÁ cadastrados antes do
 * fix não foram propagados — a Garantia continua mostrando "expirada".
 *
 * Este script percorre todas as garantias com endossos e atualiza a
 * `Garantia.dataFim` para a maior data entre `Garantia.dataFim` original e
 * todos os endossos. Idempotente: roda quantas vezes quiser, só atualiza
 * quando há diferença.
 *
 * Rodar em produção:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-garantia-vigencia.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const garantias = await prisma.garantia.findMany({
    include: {
      endossos: {
        select: { id: true, dataFim: true, valor: true, dataInicio: true },
      },
    },
  });

  console.log(`Backfill: ${garantias.length} garantia(s) encontradas.`);
  let atualizadas = 0;
  let semMudanca = 0;

  for (const g of garantias) {
    if (g.endossos.length === 0) {
      semMudanca++;
      continue;
    }
    // Maior dataFim entre garantia + endossos. Endossos sem dataFim
    // são ignorados (vigência indeterminada).
    let maior = g.dataFim;
    for (const e of g.endossos) {
      if (e.dataFim && (!maior || e.dataFim > maior)) {
        maior = e.dataFim;
      }
    }
    if (maior && maior.getTime() !== (g.dataFim?.getTime() ?? -1)) {
      await prisma.garantia.update({
        where: { id: g.id },
        data: { dataFim: maior },
      });
      console.log(
        `  ✓ ${g.id} (${g.modalidade}): ${g.dataFim?.toISOString().slice(0, 10) ?? "—"} → ${maior.toISOString().slice(0, 10)}`,
      );
      atualizadas++;
    } else {
      semMudanca++;
    }
  }

  console.log(`Backfill concluído. ${atualizadas} atualizada(s), ${semMudanca} sem mudança.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
