import "./_env";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";

/**
 * Reproduz o caso do Igor (15/09/2026, Ata 39 da C.L.A dos Santos / CCOMGEX)
 * no banco LOCAL:
 *
 *   1ª vigência: 1000 M², já com 800 consumidos → sobram 200
 *   2ª vigência: 1000 M² renovados
 *   execução demandada: 743,75 M² = 200 da 1ª + 543,75 da 2ª
 *
 * O que este teste protege é a conta. Enquanto o consumo era atribuído pela
 * vigência do EMPENHO, os 743,75 caíam inteiros numa vigência só: uma estourava
 * o saldo e a outra ficava intacta. Agora cada linha é cobrada da vigência do
 * item que ela consome.
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

async function main() {
  const conta = await prisma.conta.create({ data: { tipo: "EMPRESA", plano: "BASICO", statusAssinatura: "TRIAL" } });
  const empresa = await prisma.empresa.create({
    data: {
      contaId: conta.id, razaoSocial: "C.L.A TESTE LTDA",
      cnpj: `97${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
      porte: "ME", naturezaJuridica: "LTDA", endereco: "Brasília/DF", cep: "70070000",
      email: "teste@exemplo.invalid", telefones: "(61) 90000-0000", responsavel: "Teste",
    },
  });
  const ata = await prisma.ata.create({
    data: {
      empresaId: empresa.id, tipo: "FORNECIMENTO", numero: "39-TESTE",
      processoAdministrativo: "PA", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "CCOMGEX", orgaoCnpj: "00000000000191", orgaoEndereco: "Brasília/DF",
      objeto: "Locação de painéis de LED",
      dataAssinatura: new Date("2025-09-30"), vigenciaInicio: new Date("2025-09-30"),
      vigenciaFim: new Date("2027-09-29"),
    },
  });

  const DESC = "Locação de Painéis de Led";
  const vig1 = await prisma.vigencia.create({
    data: { ordem: 1, dataInicio: new Date("2025-09-30"), dataFim: new Date("2026-09-30"), valorTotal: 95000, ataId: ata.id, observacao: "Vigência original" },
  });
  const item1 = await prisma.ataItem.create({
    data: { descricao: DESC, unidade: "M²/Diária", quantidade: 1000, valorUnitario: 95, valorTotal: 95000, ataId: ata.id, vigenciaId: vig1.id },
  });
  const vig2 = await prisma.vigencia.create({
    data: { ordem: 2, dataInicio: new Date("2026-09-29"), dataFim: new Date("2027-09-29"), valorTotal: 99410, ataId: ata.id, observacao: "Prorrogação via Termo Aditivo" },
  });
  const item2 = await prisma.ataItem.create({
    data: { descricao: DESC, unidade: "M²/Diária", quantidade: 1000, valorUnitario: 99.41, valorTotal: 99410, ataId: ata.id, vigenciaId: vig2.id },
  });

  const baseEmpenho = {
    tipo: "FORNECIMENTO" as const, processoAdministrativo: "PA", procedimentoSelecao: "PREGAO_ELETRONICO" as const,
    empresaId: empresa.id, ataId: ata.id, instrumento: "NOTA_EMPENHO" as const,
    orgaoNome: "CCOMGEX", orgaoCnpj: "00000000000191", orgaoEndereco: "Brasília/DF",
    objeto: DESC,
  };

  // Consumo anterior: 800 M² na 1ª vigência, deixando 200 de saldo.
  await prisma.empenho.create({
    data: {
      ...baseEmpenho, numero: "938", vigenciaId: vig1.id,
      dataEmissao: new Date("2026-01-10"), vigenciaInicio: new Date("2025-09-30"), vigenciaFim: new Date("2026-09-30"),
      itens: { create: [{ descricao: DESC, unidade: "M²/Diária", quantidade: 800, valorUnitario: 95, valorTotal: 76000, ataItemId: item1.id }] },
    },
  });

  console.log("\nPonto de partida (o que o Igor descreveu):");
  let saldo = await calcularSaldoAta(ata.id);
  const s1 = () => saldo.vigencias.find((v) => v.ordem === 1)!;
  const s2 = () => saldo.vigencias.find((v) => v.ordem === 2)!;
  conferir("1ª vigência com 200 de saldo", s1().itens[0].quantidadeDisponivel, 200);
  conferir("2ª vigência com 1000 de saldo", s2().itens[0].quantidadeDisponivel, 1000);

  // A execução que o sistema não deixava lançar: 743,75 partidos entre as duas.
  console.log("\nExecução única de 743,75 M² atravessando as duas vigências:");
  await prisma.empenho.create({
    data: {
      ...baseEmpenho, numero: "1001", vigenciaId: vig2.id,
      dataEmissao: new Date("2026-10-02"), vigenciaInicio: new Date("2026-09-29"), vigenciaFim: new Date("2027-09-29"),
      itens: {
        create: [
          { descricao: DESC, unidade: "M²/Diária", quantidade: 200, valorUnitario: 95, valorTotal: 19000, ataItemId: item1.id },
          { descricao: DESC, unidade: "M²/Diária", quantidade: 543.75, valorUnitario: 99.41, valorTotal: 54054.94, ataItemId: item2.id },
        ],
      },
    },
  });

  saldo = await calcularSaldoAta(ata.id);
  conferir("1ª vigência zera (200 − 200)", s1().itens[0].quantidadeDisponivel, 0);
  conferir("1ª vigência acusa 1000 usados", s1().itens[0].quantidadeUsada, 1000);
  conferir("2ª vigência desce para 456,25 (1000 − 543,75)", s2().itens[0].quantidadeDisponivel, 456.25);
  conferir("2ª vigência acusa 543,75 usados", s2().itens[0].quantidadeUsada, 543.75);
  conferir(
    "nenhuma vigência estourou o saldo",
    saldo.vigencias.every((v) => v.itens.every((i) => i.quantidadeUsada <= i.quantidadeTotal)),
    true,
  );

  // O empenho continua sendo UM só — é assim que o órgão emitiu.
  const emp = await prisma.empenho.findFirst({ where: { numero: "1001" }, select: { _count: { select: { itens: true } } } });
  conferir("a execução é uma só, com duas linhas", emp?._count.itens, 2);

  // ── Regressão: o caso que o Igor relatou em 09/06 ────────────────────────
  // Quando o formulário só listava a vigência corrente, quem lançava execução
  // retroativa era obrigado a escolher o item da vigência ERRADA. Essas
  // execuções existem na base e tocam uma vigência só — têm que continuar
  // sendo cobradas pelo empenho, senão consumo já conciliado muda de lugar
  // sozinho no dia do deploy.
  console.log("\nRegressão — execução retroativa com item da vigência errada:");
  const ata2 = await prisma.ata.create({
    data: {
      empresaId: empresa.id, tipo: "FORNECIMENTO", numero: "66-TESTE",
      processoAdministrativo: "PA", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "TST", orgaoCnpj: "00000000000191", orgaoEndereco: "Brasília/DF",
      objeto: DESC, dataAssinatura: new Date("2025-09-30"),
      vigenciaInicio: new Date("2025-09-30"), vigenciaFim: new Date("2027-09-29"),
    },
  });
  const bVig1 = await prisma.vigencia.create({
    data: { ordem: 1, dataInicio: new Date("2025-09-30"), dataFim: new Date("2026-09-30"), valorTotal: 95000, ataId: ata2.id },
  });
  await prisma.ataItem.create({
    data: { descricao: DESC, unidade: "M²/Diária", quantidade: 1000, valorUnitario: 95, valorTotal: 95000, ataId: ata2.id, vigenciaId: bVig1.id },
  });
  const bVig2 = await prisma.vigencia.create({
    data: { ordem: 2, dataInicio: new Date("2026-09-29"), dataFim: new Date("2027-09-29"), valorTotal: 99410, ataId: ata2.id },
  });
  const bItem2 = await prisma.ataItem.create({
    data: { descricao: DESC, unidade: "M²/Diária", quantidade: 1000, valorUnitario: 99.41, valorTotal: 99410, ataId: ata2.id, vigenciaId: bVig2.id },
  });

  // Empenho DA 1ª vigência, mas com o item da 2ª — o que a tela antiga forçava.
  await prisma.empenho.create({
    data: {
      ...baseEmpenho, ataId: ata2.id, numero: "700", vigenciaId: bVig1.id,
      dataEmissao: new Date("2026-02-10"), vigenciaInicio: new Date("2025-09-30"), vigenciaFim: new Date("2026-09-30"),
      itens: { create: [{ descricao: DESC, unidade: "M²/Diária", quantidade: 300, valorUnitario: 95, valorTotal: 28500, ataItemId: bItem2.id }] },
    },
  });

  const saldo2 = await calcularSaldoAta(ata2.id);
  const b1 = saldo2.vigencias.find((v) => v.ordem === 1)!;
  const b2 = saldo2.vigencias.find((v) => v.ordem === 2)!;
  conferir("consumo antigo continua na 1ª vigência", b1.itens[0].quantidadeUsada, 300);
  conferir("2ª vigência segue intacta", b2.itens[0].quantidadeDisponivel, 1000);

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
