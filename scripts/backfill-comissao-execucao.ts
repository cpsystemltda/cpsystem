/**
 * Backfill de ComissaoExecucao para empenhos pré-existentes.
 *
 * Por que: a feature de Linha A/B foi adicionada depois de já existirem
 * empenhos no banco. Para todos eles, precisamos criar uma linha de comissão
 * por vínculo ativo cuja dataInicio é anterior à criação do empenho.
 *
 * Idempotente: usa upsert (@@unique(empenhoId, vinculoId)).
 *
 * Quando rodar: 1x, após o deploy da migração `add_comissao_execucao`.
 * Em produção, costuma ser:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/backfill-comissao-execucao.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const empenhos = await prisma.empenho.findMany({
    select: {
      id: true,
      empresaId: true,
      criadoEm: true,
      status: true,
      itens: { select: { valorTotal: true } },
    },
  });

  console.log(`Backfill: encontrados ${empenhos.length} empenhos.`);
  let criadas = 0;
  let sincronizadas = 0;

  for (const e of empenhos) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: e.empresaId },
      select: { contaId: true },
    });
    if (!empresa) continue;

    const vinculos = await prisma.vinculoAnalista.findMany({
      where: { contaId: empresa.contaId },
      select: { id: true, analistaId: true, percentualComissao: true, dataInicio: true, status: true },
    });

    const valorTotal = e.itens.reduce((s, i) => s + i.valorTotal, 0);

    for (const v of vinculos) {
      // Mesma regra do criarComissoesParaEmpenho: respeita dataInicio
      if (e.criadoEm < v.dataInicio) continue;
      // E também só cria pra vínculos que estavam ATIVOS quando o empenho foi
      // criado. Hoje só temos o status atual; assumimos que se está
      // ENCERRADO mas a comissão deveria existir, isso é decisão manual.
      if (v.status === "ENCERRADO") continue;

      // Empenho já PAGO: comissão tem que entrar em A_RECEBER (Linha A já
      // ocorreu) com valorBasePago = valor total.
      // Não-PAGO: AGUARDANDO_ORGAO.
      const linhaAPaga = e.status === "PAGO";
      const valorBasePago = linhaAPaga ? valorTotal : 0;
      const valorCalculado = valorBasePago * (v.percentualComissao / 100);

      const result = await prisma.comissaoExecucao.upsert({
        where: {
          empenhoId_vinculoId: { empenhoId: e.id, vinculoId: v.id },
        },
        create: {
          empenhoId: e.id,
          vinculoId: v.id,
          analistaId: v.analistaId,
          percentual: v.percentualComissao,
          valorBaseEmpenho: valorTotal,
          valorBasePago,
          valorCalculado,
          status: linhaAPaga ? "A_RECEBER" : "AGUARDANDO_ORGAO",
        },
        update: {
          // Em empenhos legados que já tinham comissão antiga, sincroniza
          // valorBasePago caso o status PAGO tenha mudado depois.
          valorBaseEmpenho: valorTotal,
          ...(linhaAPaga
            ? { valorBasePago, valorCalculado }
            : {}),
        },
      });
      if (result.criadoEm.getTime() === result.atualizadoEm.getTime()) criadas++;
      else sincronizadas++;
    }
  }

  console.log(`Backfill concluído. ${criadas} criadas, ${sincronizadas} atualizadas.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
