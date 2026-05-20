/**
 * Investigação do Contrato 82/2024 UNB — Igor reportou que o endosso foi
 * cadastrado mas o sistema continua mostrando vigência da garantia expirada.
 *
 * Hipóteses:
 *  H1: endosso cadastrado SEM dataFim → não pôde estender garantia.dataFim
 *  H2: endosso cadastrado ANTES do fix b4094a9 → ficou orfão (action antiga
 *      não atualizava garantia.dataFim)
 *  H3: endosso com dataFim, mas action antiga; precisa de heal retroativo
 *
 * Rodar:
 *   set -a && source .env.local && set +a && npx tsx scripts/investigar-garantia-82-2024.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const c = await prisma.contrato.findFirst({
    where: { numero: "82/2024" },
    include: {
      garantias: {
        include: { endossos: { orderBy: { dataInicio: "asc" } } },
        orderBy: { criadoEm: "desc" },
      },
    },
  });
  if (!c) {
    console.log("Contrato 82/2024 não encontrado.");
    return;
  }

  console.log(`\n=== Contrato ${c.numero} (id ${c.id}) ===`);
  console.log(`temGarantia: ${c.temGarantia}`);
  console.log(`Garantias: ${c.garantias.length}\n`);

  for (const g of c.garantias) {
    console.log(`--- Garantia ${g.id} ---`);
    console.log(`  modalidade:  ${g.modalidade}`);
    console.log(`  valor base:  R$ ${g.valor.toFixed(2)}`);
    console.log(`  dataInicio:  ${g.dataInicio.toISOString().slice(0, 10)}`);
    console.log(`  dataFim:     ${g.dataFim ? g.dataFim.toISOString().slice(0, 10) : "(null)"}`);
    console.log(`  criadoEm:    ${g.criadoEm.toISOString().slice(0, 19).replace("T", " ")}`);
    console.log(`  Endossos:    ${g.endossos.length}`);
    for (const e of g.endossos) {
      const estende = e.dataFim && (!g.dataFim || e.dataFim > g.dataFim);
      console.log(
        `    + R$ ${e.valor.toFixed(2)} | ` +
          `início ${e.dataInicio.toISOString().slice(0, 10)} | ` +
          `fim ${e.dataFim ? e.dataFim.toISOString().slice(0, 10) : "(null)"} | ` +
          `${estende ? "ESTENDE garantia" : "não estende"}`,
      );
    }
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
