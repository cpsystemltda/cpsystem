/**
 * Backfill: aplica reajustes legados (model `Reajuste`) nos itens do contrato
 * quando ainda não foram aplicados.
 *
 * Detecção:
 *   - Pra cada Reajuste sem aplicação aparente (soma itens ≈ valorAnterior),
 *     aplica o percentual em todos os itens e bumpa marcoOrcamentoEstimado.
 *   - Se soma itens ≈ valorNovo, considera já aplicado. Skip.
 *   - Caso ambíguo (nem um nem outro), skip e avisa.
 *
 * Idempotente: roda quantas vezes precisar.
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-reajustes-legados.ts
 */
import { prisma } from "@/lib/prisma";

const TOLERANCIA = 0.5; // R$ — diferença aceitável pra considerar "igual"

function aproxIgual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCIA;
}

async function main() {
  const reajustes = await prisma.reajuste.findMany({
    where: { contratoId: { not: null } },
    orderBy: { dataPedido: "asc" },
  });

  console.log(`\nBackfill: ${reajustes.length} reajuste(s) legado(s) vinculados a contrato.`);
  let aplicados = 0;
  let jaAplicados = 0;
  let ambiguos = 0;

  for (const r of reajustes) {
    if (!r.contratoId) continue;
    const c = await prisma.contrato.findUnique({
      where: { id: r.contratoId },
      include: { itens: true },
    });
    if (!c) continue;
    const somaAtual = c.itens.reduce((s, i) => s + i.valorTotal, 0);

    if (aproxIgual(somaAtual, r.valorNovo)) {
      jaAplicados++;
      console.log(`  ⏭  ${c.numero} | ${r.indice} ${r.percentual}% — já aplicado (soma=${somaAtual.toFixed(2)} ≈ valorNovo=${r.valorNovo.toFixed(2)})`);
      continue;
    }

    if (!aproxIgual(somaAtual, r.valorAnterior)) {
      ambiguos++;
      console.warn(`  ⚠  ${c.numero} | ${r.indice} ${r.percentual}% — AMBÍGUO: soma=${somaAtual.toFixed(2)}, valorAnterior=${r.valorAnterior.toFixed(2)}, valorNovo=${r.valorNovo.toFixed(2)}. Skip pra revisão manual.`);
      continue;
    }

    // Aplicar: soma atual ≈ valorAnterior → ainda não aplicou
    const fator = 1 + r.percentual / 100;
    console.log(`  ✓ ${c.numero} | aplicando ${r.indice} ${r.percentual}% (R$ ${r.valorAnterior.toFixed(2)} → R$ ${r.valorNovo.toFixed(2)})`);
    for (const it of c.itens) {
      const novoUnit = it.valorUnitario * fator;
      const novoTotal = novoUnit * it.quantidade;
      await prisma.contratoItem.update({
        where: { id: it.id },
        data: { valorUnitario: novoUnit, valorTotal: novoTotal },
      });
    }
    // Bumpa marco pra próximo ciclo de 12m a partir do reajuste
    await prisma.contrato.update({
      where: { id: c.id },
      data: { marcoOrcamentoEstimado: r.dataAprovacao ?? r.dataPedido },
    });
    aplicados++;
  }

  console.log(`\nBackfill concluído.`);
  console.log(`  Aplicados: ${aplicados}`);
  console.log(`  Já aplicados: ${jaAplicados}`);
  console.log(`  Ambíguos (skip): ${ambiguos}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
