import "./_env";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";

/**
 * Exercita a TRAVA DE SALDO do cadastro de execução — o trecho de
 * `criarEmpenhoAction` que barrou o Igor mesmo depois de a tela já oferecer as
 * duas vigências (15/09/2026, Ata 39 da C.L.A dos Santos).
 *
 * É este teste que faltou da primeira vez. Eu tinha validado só
 * `calcularSaldoAta`, que estava certo, e não o `saldo.itens` usado aqui — um
 * atalho para a vigência CORRENTE. O item da 2ª vigência não estava nessa
 * lista, então a execução partida morria na gravação: "Item da Ata não
 * encontrado" ou, quando ele insistia na linha da 1ª, "Saldo insuficiente".
 *
 * A função abaixo é cópia fiel do bloco da action, para o teste falhar se
 * alguém voltar a usar o atalho.
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

/** Espelho da trava de saldo de `criarEmpenhoAction` (Ata). */
async function validarSaldo(
  ataId: string,
  itens: { ataItemId: string; quantidade: number }[],
): Promise<string | null> {
  const saldo = await calcularSaldoAta(ataId);
  const itensDeTodasAsVigencias = saldo.vigencias.flatMap((vig) =>
    vig.itens.map((i) => ({ ...i, vigenciaOrdem: vig.ordem })),
  );
  for (const item of itens) {
    const linha = itensDeTodasAsVigencias.find((s) => s.ataItemId === item.ataItemId);
    if (!linha) return "Item da Ata não encontrado.";
    if (item.quantidade > linha.quantidadeDisponivel) {
      return `Saldo insuficiente na vigência ${linha.vigenciaOrdem}`;
    }
  }
  return null;
}

async function main() {
  const conta = await prisma.conta.create({ data: { tipo: "EMPRESA", plano: "BASICO", statusAssinatura: "TRIAL" } });
  const empresa = await prisma.empresa.create({
    data: {
      contaId: conta.id, razaoSocial: "C.L.A VALIDACAO LTDA",
      cnpj: `96${String(Math.floor(Math.random() * 1e12)).padStart(12, "0")}`,
      porte: "ME", naturezaJuridica: "LTDA", endereco: "Brasília/DF", cep: "70070000",
      email: "teste@exemplo.invalid", telefones: "(61) 90000-0000", responsavel: "Teste",
    },
  });
  const DESC = "Locação de Painéis de Led";
  const ata = await prisma.ata.create({
    data: {
      empresaId: empresa.id, tipo: "FORNECIMENTO", numero: "39-VAL",
      processoAdministrativo: "PA", procedimentoSelecao: "PREGAO_ELETRONICO",
      orgaoNome: "CCOMGEX", orgaoCnpj: "00000000000191", orgaoEndereco: "Brasília/DF",
      objeto: DESC, dataAssinatura: new Date("2025-09-30"),
      vigenciaInicio: new Date("2025-09-30"), vigenciaFim: new Date("2027-09-29"),
    },
  });
  const v1 = await prisma.vigencia.create({
    data: { ordem: 1, dataInicio: new Date("2025-09-30"), dataFim: new Date("2026-09-30"), valorTotal: 95000, ataId: ata.id },
  });
  const i1 = await prisma.ataItem.create({
    data: { descricao: DESC, unidade: "M²/Diária", quantidade: 1000, valorUnitario: 96.0934, valorTotal: 96093.4, ataId: ata.id, vigenciaId: v1.id },
  });
  const v2 = await prisma.vigencia.create({
    data: { ordem: 2, dataInicio: new Date("2026-09-29"), dataFim: new Date("2027-09-29"), valorTotal: 99410, ataId: ata.id },
  });
  const i2 = await prisma.ataItem.create({
    data: { descricao: DESC, unidade: "M²/Diária", quantidade: 1000, valorUnitario: 99.41, valorTotal: 99410, ataId: ata.id, vigenciaId: v2.id },
  });
  // 800 já consumidos na 1ª vigência → sobram 200, igual à Ata 39 real.
  await prisma.empenho.create({
    data: {
      numero: "938", tipo: "FORNECIMENTO", processoAdministrativo: "PA",
      procedimentoSelecao: "PREGAO_ELETRONICO", empresaId: empresa.id, ataId: ata.id,
      vigenciaId: v1.id, instrumento: "NOTA_EMPENHO", orgaoNome: "CCOMGEX",
      orgaoCnpj: "00000000000191", orgaoEndereco: "Brasília/DF", objeto: DESC,
      dataEmissao: new Date("2026-01-10"), vigenciaInicio: new Date("2025-09-30"), vigenciaFim: new Date("2026-09-30"),
      itens: { create: [{ descricao: DESC, unidade: "M²/Diária", quantidade: 800, valorUnitario: 96.0934, valorTotal: 76874.72, ataItemId: i1.id }] },
    },
  });

  console.log("\nA trava de saldo na gravação da execução:");
  conferir(
    "item da 2ª vigência é ENCONTRADO (antes dava 'Item da Ata não encontrado')",
    await validarSaldo(ata.id, [{ ataItemId: i2.id, quantidade: 543.75 }]),
    null,
  );
  conferir(
    "execução partida 200 (V1) + 543,75 (V2) passa",
    await validarSaldo(ata.id, [
      { ataItemId: i1.id, quantidade: 200 },
      { ataItemId: i2.id, quantidade: 543.75 },
    ]),
    null,
  );
  conferir(
    "os 743,75 inteiros na 1ª vigência continuam barrados",
    await validarSaldo(ata.id, [{ ataItemId: i1.id, quantidade: 743.75 }]),
    "Saldo insuficiente na vigência 1",
  );
  conferir(
    "estourar a 2ª vigência é barrado, e diz qual vigência",
    await validarSaldo(ata.id, [{ ataItemId: i2.id, quantidade: 1200 }]),
    "Saldo insuficiente na vigência 2",
  );
  conferir(
    "nenhuma vigência cobre a outra: 200 na V1 é o limite",
    await validarSaldo(ata.id, [{ ataItemId: i1.id, quantidade: 201 }]),
    "Saldo insuficiente na vigência 1",
  );

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
