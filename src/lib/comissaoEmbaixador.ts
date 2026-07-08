import "server-only";
import { prisma } from "@/lib/prisma";

// Comissao do Programa Analista Parceiro (embaixador) — modelo Regina 03/07:
// R$ 29,90 FIXO por conta indicada ATIVA (ja pagou ao menos 1 fatura),
// recorrente vitalicio + bonus R$ 500 na 1a fatura.
//
// Este helper e o CANONICO: acionado tanto pelo cron diario (regua) quanto
// pelo painel admin. E idempotente (upsert por competencia), entao pode
// rodar varias vezes no mesmo mes sem duplicar.

const PRECOS = { BASICO: 397, PREMIUM: 997 };
export const COMISSAO_FIXA_POR_VINCULO = 29.9;
export const BONUS_PRIMEIRA_FATURA = 500;

export async function calcularComissoesDoMes(hoje: Date = new Date()): Promise<{
  competencia: string;
  vinculos: number;
  bonusIniciais: number;
  totalGeradoBRL: number;
}> {
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const analistas = await prisma.analista.findMany({
    where: { ativo: true },
    include: {
      contasIndicadas: {
        where: {
          statusAssinatura: "ATIVA",
          // Gatilho (Regina 07/06): so conta depois da 1a fatura paga.
          cobrancas: { some: { status: "PAGA" } },
        },
      },
    },
  });

  let vinculos = 0;
  let bonusIniciais = 0;
  let totalGeradoBRL = 0;
  const ops: Promise<unknown>[] = [];

  for (const a of analistas) {
    if (a.contasIndicadas.length === 0) continue;

    for (const conta of a.contasIndicadas) {
      const valorBase = PRECOS[conta.plano as "BASICO" | "PREMIUM"] ?? 0;

      // Comissao mensal fixa
      ops.push(
        prisma.comissao.upsert({
          where: { analistaId_contaId_competencia: { analistaId: a.id, contaId: conta.id, competencia } },
          update: {
            valorBase,
            tier: "BRONZE",
            percentual: 0,
            valor: COMISSAO_FIXA_POR_VINCULO,
          },
          create: {
            analistaId: a.id,
            contaId: conta.id,
            competencia,
            valorBase,
            tier: "BRONZE",
            percentual: 0,
            valor: COMISSAO_FIXA_POR_VINCULO,
          },
        }),
      );
      vinculos++;
      totalGeradoBRL += COMISSAO_FIXA_POR_VINCULO;

      // Bonus R$ 500 na 1a fatura paga — detecta se mesEm da 1a paga bate
      // com a competencia atual (idempotente por chave -BONUS-INICIO)
      const primeiraPaga = await prisma.cobranca.findFirst({
        where: { contaId: conta.id, status: "PAGA" },
        orderBy: { pagaEm: "asc" },
        select: { pagaEm: true },
      });
      if (primeiraPaga?.pagaEm) {
        const mesPaga = primeiraPaga.pagaEm.toISOString().slice(0, 7);
        if (mesPaga === competencia) {
          ops.push(
            prisma.comissao.upsert({
              where: {
                analistaId_contaId_competencia: {
                  analistaId: a.id,
                  contaId: conta.id,
                  competencia: `${competencia}-BONUS-INICIO`,
                },
              },
              update: { valor: BONUS_PRIMEIRA_FATURA, valorBase: 0, percentual: 0, tier: "BRONZE" },
              create: {
                analistaId: a.id,
                contaId: conta.id,
                competencia: `${competencia}-BONUS-INICIO`,
                valorBase: 0,
                percentual: 0,
                tier: "BRONZE",
                valor: BONUS_PRIMEIRA_FATURA,
              },
            }),
          );
          bonusIniciais++;
          totalGeradoBRL += BONUS_PRIMEIRA_FATURA;
        }
      }
    }
  }

  await Promise.all(ops);
  return { competencia, vinculos, bonusIniciais, totalGeradoBRL };
}
