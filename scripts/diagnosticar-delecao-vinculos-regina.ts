/**
 * Levanta o impacto de deletar os vínculos da empresa "Regina Luíza" (CNPJ
 * 42736317000130) — quantas linhas de PagamentoFixoMensal e ComissaoExecucao
 * existem, quanto desse total foi marcado como pago (irreversível), e quanto
 * está pendente.
 *
 * NÃO DELETA — só inspeciona. Rode antes de qualquer operação destrutiva.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/diagnosticar-delecao-vinculos-regina.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CNPJ_REGINA = "42736317000130";

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function main() {
  const empresa = await prisma.empresa.findUnique({
    where: { cnpj: CNPJ_REGINA },
    select: { id: true, contaId: true, razaoSocial: true, nomeFantasia: true },
  });
  if (!empresa) {
    console.log("Empresa Regina Luíza não encontrada pelo CNPJ.");
    return;
  }
  console.log(`Empresa: ${empresa.nomeFantasia || empresa.razaoSocial} (contaId: ${empresa.contaId})\n`);

  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { contaId: empresa.contaId },
    include: {
      analista: { select: { nomeCompleto: true } },
      _count: {
        select: { fixosPagos: true, comissoesExecucao: true },
      },
    },
  });

  console.log(`=== ${vinculos.length} vínculo(s) que seriam apagados ===\n`);

  let totalFixoPagosBruto = 0;
  let totalFixoPendentes = 0;
  let totalFixoLinhasPagas = 0;
  let totalFixoLinhasPendentes = 0;
  let totalVariavelPago = 0;
  let totalVariavelPendente = 0;
  let totalVariavelLinhasPagas = 0;
  let totalVariavelLinhasPendentes = 0;

  for (const v of vinculos) {
    const fixos = await prisma.pagamentoFixoMensal.findMany({
      where: { vinculoId: v.id },
      select: { status: true, valor: true, valorRecebido: true },
    });
    const variaveis = await prisma.comissaoExecucao.findMany({
      where: { vinculoId: v.id },
      select: { status: true, valorCalculado: true, valorRecebido: true },
    });

    const fixoPagas = fixos.filter((f) => f.status === "PAGO" || f.status === "PAGO_PARCIAL");
    const variavelPagas = variaveis.filter(
      (c) => c.status === "PAGO" || c.status === "PAGO_PARCIAL",
    );

    const fixoPagoTotal = fixoPagas.reduce((s, f) => s + (f.valorRecebido ?? f.valor), 0);
    const fixoPendenteTotal = fixos
      .filter((f) => f.status !== "PAGO")
      .reduce((s, f) => s + f.valor, 0);
    const varPagoTotal = variavelPagas.reduce(
      (s, c) => s + (c.valorRecebido ?? c.valorCalculado),
      0,
    );
    const varPendenteTotal = variaveis
      .filter((c) => c.status !== "PAGO")
      .reduce((s, c) => s + c.valorCalculado, 0);

    totalFixoPagosBruto += fixoPagoTotal;
    totalFixoPendentes += fixoPendenteTotal;
    totalFixoLinhasPagas += fixoPagas.length;
    totalFixoLinhasPendentes += fixos.length - fixoPagas.length;
    totalVariavelPago += varPagoTotal;
    totalVariavelPendente += varPendenteTotal;
    totalVariavelLinhasPagas += variavelPagas.length;
    totalVariavelLinhasPendentes += variaveis.length - variavelPagas.length;

    console.log(`▸ ${v.analista.nomeCompleto} (${v.status})`);
    console.log(`  Fixo:     ${fixos.length} linha(s) — ${fixoPagas.length} pagas (${brl(fixoPagoTotal)}) · ${fixos.length - fixoPagas.length} pendentes`);
    console.log(`  Variável: ${variaveis.length} comissão(ões) — ${variavelPagas.length} pagas (${brl(varPagoTotal)}) · ${variaveis.length - variavelPagas.length} pendentes`);
  }

  console.log("\n=== Totais que seriam apagados ===");
  console.log(`Comissão fixa: ${totalFixoLinhasPagas + totalFixoLinhasPendentes} linha(s)`);
  console.log(`  ↳ ${totalFixoLinhasPagas} já paga(s) — ${brl(totalFixoPagosBruto)} (histórico contábil)`);
  console.log(`  ↳ ${totalFixoLinhasPendentes} pendente(s) — ${brl(totalFixoPendentes)}`);
  console.log(`Comissão variável: ${totalVariavelLinhasPagas + totalVariavelLinhasPendentes} linha(s)`);
  console.log(`  ↳ ${totalVariavelLinhasPagas} já paga(s) — ${brl(totalVariavelPago)} (histórico contábil)`);
  console.log(`  ↳ ${totalVariavelLinhasPendentes} pendente(s) — ${brl(totalVariavelPendente)}`);

  console.log("\n⚠️  Deleção é CASCADE — apaga tudo acima (não desfaz).");
  console.log("    Considere apenas ENCERRAR os vínculos (status=ENCERRADO) — mantém histórico.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
