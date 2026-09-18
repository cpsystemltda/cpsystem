import "./_env";
import { prisma } from "@/lib/prisma";

/**
 * Exercita, contra o banco LOCAL, a limpeza que passou a acontecer ao excluir
 * um termo aditivo (Igor 15/09/2026, Ata 39 da C.L.A dos Santos).
 *
 * Reproduz a sequência exata do bug: aditivo prorroga → nasce a vigência 2 com
 * os itens copiados → aditivo é excluído. Antes, a vigência 2 sobrevivia órfã
 * e envenenava a prorrogação seguinte, que copia itens da ÚLTIMA vigência.
 *
 * O segundo cenário é o que protege histórico: vigência com empenho lançado
 * NÃO pode ser apagada junto.
 */
const url = process.env.DATABASE_URL || "";
if (!/localhost|127\.0\.0\.1/.test(url) || /neon\.tech/.test(url)) {
  console.error("Recusando rodar: DATABASE_URL não é local.\n  " + url);
  process.exit(1);
}

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`  ${ok ? "✓" : "✗"} ${nome}${ok ? "" : `  (esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)})`}`);
}

/** A mesma limpeza que `excluirTermoAditivoAction` faz antes de apagar o aditivo. */
async function limparVigenciaDoAditivo(aditivoId: string): Promise<"removida" | "preservada" | "nenhuma"> {
  const vig = await prisma.vigencia.findUnique({
    where: { termoAditivoId: aditivoId },
    select: { id: true, _count: { select: { empenhos: true } } },
  });
  if (!vig) return "nenhuma";
  if (vig._count.empenhos > 0) return "preservada";
  await prisma.ataItem.deleteMany({ where: { vigenciaId: vig.id } });
  await prisma.contratoItem.deleteMany({ where: { vigenciaId: vig.id } });
  await prisma.vigencia.delete({ where: { id: vig.id } });
  return "removida";
}

async function main() {
  const conta = await prisma.conta.create({
    data: { tipo: "EMPRESA", plano: "BASICO", statusAssinatura: "TRIAL" },
  });
  const empresa = await prisma.empresa.create({
    data: {
      contaId: conta.id,
      razaoSocial: "TESTE ADITIVO LTDA",
      cnpj: `98${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
      porte: "ME",
      naturezaJuridica: "LTDA",
      endereco: "Brasília/DF",
      cep: "70070000",
      email: "teste@exemplo.invalid",
      telefones: "(61) 90000-0000",
      responsavel: "Teste",
    },
  });
  const ata = await prisma.ata.create({
    data: {
      empresaId: empresa.id,
      tipo: "FORNECIMENTO",
      numero: "39-TESTE",
      processoAdministrativo: "PA",
      procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "CCOMGEX",
      orgaoCnpj: "00000000000191",
      orgaoEndereco: "Brasília/DF",
      objeto: "Locação de painéis de LED",
      dataAssinatura: new Date("2025-09-30"),
      vigenciaInicio: new Date("2025-09-30"),
      vigenciaFim: new Date("2026-09-30"),
    },
  });

  const vig1 = await prisma.vigencia.create({
    data: { ordem: 1, dataInicio: new Date("2025-09-30"), dataFim: new Date("2026-09-30"), valorTotal: 95000, ataId: ata.id, observacao: "Vigência original" },
  });
  await prisma.ataItem.create({
    data: { descricao: "Painel de LED", unidade: "M²/Diária", quantidade: 1000, valorUnitario: 95, valorTotal: 95000, ataId: ata.id, vigenciaId: vig1.id },
  });

  // ── Cenário 1: aditivo prorroga, cria vigência 2 com itens, e é excluído ──
  console.log("\nCenário 1 — vigência criada pelo aditivo, sem execução:");
  const aditivo = await prisma.termoAditivo.create({
    data: { numero: "01", objeto: "Prorrogação de vigência", dataAssinatura: new Date("2026-08-29"), natureza: "PRAZO_VIGENCIA", ataId: ata.id },
  });
  const vig2 = await prisma.vigencia.create({
    data: { ordem: 2, dataInicio: new Date("2026-09-29"), dataFim: new Date("2027-09-29"), valorTotal: 95000, ataId: ata.id, termoAditivoId: aditivo.id, observacao: "Prorrogação via Termo Aditivo" },
  });
  await prisma.ataItem.create({
    data: { descricao: "Painel de LED", unidade: "M²/Diária", quantidade: 1000, valorUnitario: 95, valorTotal: 95000, ataId: ata.id, vigenciaId: vig2.id },
  });

  conferir("antes: a ata tem 2 vigências", await prisma.vigencia.count({ where: { ataId: ata.id } }), 2);
  conferir("antes: a ata tem 2 itens", await prisma.ataItem.count({ where: { ataId: ata.id } }), 2);

  conferir("limpeza reporta 'removida'", await limparVigenciaDoAditivo(aditivo.id), "removida");
  await prisma.termoAditivo.delete({ where: { id: aditivo.id } });

  conferir("depois: sobra só a vigência original", await prisma.vigencia.count({ where: { ataId: ata.id } }), 1);
  conferir("depois: sobra só o item original", await prisma.ataItem.count({ where: { ataId: ata.id } }), 1);
  conferir("depois: o item que restou é o da vigência 1", await prisma.ataItem.count({ where: { vigenciaId: vig1.id } }), 1);

  // ── Cenário 2: vigência do aditivo já tem execução — não pode sumir ──
  console.log("\nCenário 2 — vigência do aditivo já tem execução lançada:");
  const aditivo2 = await prisma.termoAditivo.create({
    data: { numero: "02", objeto: "Prorrogação de vigência", dataAssinatura: new Date("2026-09-01"), natureza: "PRAZO_VIGENCIA", ataId: ata.id },
  });
  const vig3 = await prisma.vigencia.create({
    data: { ordem: 2, dataInicio: new Date("2026-10-01"), dataFim: new Date("2027-10-01"), valorTotal: 95000, ataId: ata.id, termoAditivoId: aditivo2.id, observacao: "Prorrogação via Termo Aditivo" },
  });
  await prisma.empenho.create({
    data: {
      numero: "938", tipo: "FORNECIMENTO", processoAdministrativo: "PA", empresaId: empresa.id, ataId: ata.id, vigenciaId: vig3.id,
      instrumento: "NOTA_EMPENHO", orgaoNome: "CCOMGEX", orgaoCnpj: "00000000000191", orgaoEndereco: "Brasília/DF", procedimentoSelecao: "PREGAO_ELETRONICO", objeto: "Painéis de LED",
      dataEmissao: new Date("2026-10-05"), vigenciaInicio: new Date("2026-10-01"), vigenciaFim: new Date("2027-10-01"),
    },
  });

  conferir("limpeza reporta 'preservada'", await limparVigenciaDoAditivo(aditivo2.id), "preservada");
  conferir("a vigência com execução continua lá", await prisma.vigencia.count({ where: { id: vig3.id } }), 1);
  conferir("a execução continua lá", await prisma.empenho.count({ where: { vigenciaId: vig3.id } }), 1);

  await prisma.conta.delete({ where: { id: conta.id } });
  console.log(`\nDados de teste removidos.\n${falhas === 0 ? "TUDO PASSOU" : `${falhas} FALHA(S)`}\n`);
  await prisma.$disconnect();
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
