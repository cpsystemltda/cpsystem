/**
 * Inspeciona vínculos analista-empresa pra entender por que não há linhas de
 * comissão fixa mensal aparecendo no painel. Mostra fixoMensal, status,
 * quantas linhas geradas existem por vínculo.
 *
 * Uso: bun scripts/inspecionar-vinculos-analistas.ts
 *      ou: tsx scripts/inspecionar-vinculos-analistas.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const vinculos = await prisma.vinculoAnalista.findMany({
    include: {
      analista: { select: { nomeCompleto: true, email: true } },
      conta: {
        select: {
          empresas: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true }, take: 1 },
        },
      },
      _count: { select: { fixosPagos: true } },
    },
    orderBy: { criadoEm: "desc" },
  });

  console.log(`\n=== ${vinculos.length} vínculo(s) encontrado(s) ===\n`);

  for (const v of vinculos) {
    const empresa =
      v.conta.empresas[0]?.nomeFantasia || v.conta.empresas[0]?.razaoSocial || "(sem empresa)";
    const cnpj = v.conta.empresas[0]?.cnpj || "—";
    const fixoStatus =
      v.fixoMensal > 0
        ? `R$ ${v.fixoMensal.toFixed(2)} (OK — gera linhas)`
        : "R$ 0,00 ❌ (NÃO gera linhas — precisa configurar)";

    console.log(`▸ ${v.analista.nomeCompleto}  ↔  ${empresa}`);
    console.log(`  ID:           ${v.id}`);
    console.log(`  CNPJ:         ${cnpj}`);
    console.log(`  Status:       ${v.status}`);
    console.log(`  Fixo mensal:  ${fixoStatus}`);
    console.log(`  % comissão:   ${v.percentualComissao}%`);
    console.log(`  Dia venc.:    ${v.diaVencimentoFixo}`);
    console.log(`  Início:       ${v.dataInicio.toLocaleDateString("pt-BR")}`);
    console.log(`  Linhas geradas (PagamentoFixoMensal): ${v._count.fixosPagos}`);
    console.log("");
  }

  // Diagnóstico final
  const ativosSemFixo = vinculos.filter((v) => v.status === "ATIVO" && v.fixoMensal === 0);
  if (ativosSemFixo.length > 0) {
    console.log(`\n⚠️  ${ativosSemFixo.length} vínculo(s) ATIVO com fixoMensal = R$ 0,00.`);
    console.log("   Esses são os que não aparecem no painel. Para corrigir, edite cada vínculo");
    console.log("   e configure o valor do fixo mensal acordado.\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
