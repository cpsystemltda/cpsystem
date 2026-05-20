/**
 * Backfill: preenche Contrato.valorInicial com o somatório dos itens atuais.
 *
 * Por que: a partir do M3 (aditivo v2), o painel exibe "Valor Atual" vs
 * "Valor Inicial" no formulário de aditivo. Pra contratos cadastrados antes
 * dessa migração, valorInicial=null — o backfill ancora no valor corrente
 * (que é o inicial, já que nenhum aditivo aplicou reajuste de itens ainda).
 *
 * Idempotente: só atualiza contratos com valorInicial=null.
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-valor-inicial-contrato.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const contratos = await prisma.contrato.findMany({
    where: { valorInicial: null },
    select: { id: true, numero: true, itens: { select: { valorTotal: true } } },
  });

  console.log(`Backfill: ${contratos.length} contrato(s) sem valorInicial.`);
  let ajustados = 0;

  for (const c of contratos) {
    const total = c.itens.reduce((acc, it) => acc + it.valorTotal, 0);
    await prisma.contrato.update({
      where: { id: c.id },
      data: { valorInicial: total },
    });
    ajustados++;
    console.log(`  ✓ Contrato ${c.numero}: R$ ${total.toFixed(2)}`);
  }

  console.log(`Backfill concluído. ${ajustados} contrato(s) atualizado(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
