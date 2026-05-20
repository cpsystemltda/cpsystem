/**
 * Investigação do Contrato 82/2024 UNB — reajuste cadastrado mas valor e
 * marco não atualizaram.
 *
 * Hipóteses:
 *  H1: reajuste foi cadastrado via legacy `Reajuste` model (não atualiza itens)
 *  H2: reajuste foi cadastrado via apostilamento ANTES do M3 (action antiga
 *      só aplicava em itens de Ata, não de Contrato)
 *  H3: aplicaReajuste=true foi marcado mas reajustePercentual veio null
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/investigar-contrato-82-2024.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const c = await prisma.contrato.findFirst({
    where: { numero: "82/2024" },
    include: {
      itens: { select: { id: true, descricao: true, valorUnitario: true, valorTotal: true } },
      termosAditivos: true,
      apostilamentos: true,
      reajustes: true,
    },
  });
  if (!c) {
    console.log("Contrato 82/2024 não encontrado.");
    return;
  }

  console.log(`\n=== Contrato ${c.numero} ===`);
  console.log(`Id: ${c.id}`);
  console.log(`valorInicial: R$ ${c.valorInicial?.toFixed(2) ?? "(null)"}`);
  console.log(`marcoOrcamentoEstimado: ${c.marcoOrcamentoEstimado?.toISOString().slice(0, 10) ?? "(null)"}`);
  console.log(`marcoReajusteOrigem: ${c.marcoReajusteOrigem ?? "(null)"}`);

  console.log(`\n--- Itens (${c.itens.length}) ---`);
  let somaItens = 0;
  for (const it of c.itens) {
    console.log(`  ${it.descricao.slice(0, 50)} : R$ ${it.valorUnitario.toFixed(2)} × ? = R$ ${it.valorTotal.toFixed(2)}`);
    somaItens += it.valorTotal;
  }
  console.log(`Total itens (calculado): R$ ${somaItens.toFixed(2)}`);

  console.log(`\n--- Aditivos (${c.termosAditivos.length}) ---`);
  for (const a of c.termosAditivos) {
    console.log(`  ${a.numero} | aplicaReajuste=${a.aplicaReajuste} | pct=${a.reajustePercentual ?? "(null)"} | indice=${a.reajusteIndice ?? "(null)"}`);
  }

  console.log(`\n--- Apostilamentos (${c.apostilamentos.length}) ---`);
  for (const ap of c.apostilamentos) {
    console.log(`  ${ap.numero} | aplicaReajuste=${ap.aplicaReajuste} | pct=${ap.reajustePercentual ?? "(null)"} | indice=${ap.reajusteIndice ?? "(null)"} | finalidade=${ap.finalidade ?? "(null)"}`);
  }

  console.log(`\n--- Reajustes (legado) (${c.reajustes.length}) ---`);
  for (const r of c.reajustes) {
    console.log(`  ${r.dataPedido.toISOString().slice(0, 10)} | ${r.indice} | ${r.percentual}% | valorAnterior=${r.valorAnterior} | valorNovo=${r.valorNovo} | instrumento=${r.instrumento}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
