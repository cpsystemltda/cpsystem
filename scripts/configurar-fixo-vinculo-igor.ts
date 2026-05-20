/**
 * Configura o vínculo Igor ↔ Igor (que estava com fixoMensal = R$ 0) com
 * o valor de teste solicitado pela Regina. Também gera a linha do mês
 * corrente em seguida, pra Igor já conseguir marcar pagamento no painel.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/configurar-fixo-vinculo-igor.ts
 */
// Não importa comissaoFixa.ts (que usa "server-only" e quebra no tsx).
// Inline da função `gerarLinhasComissaoFixaDoAnalista` aqui. Cliente Prisma
// configurado via adapter Neon (mesmo padrão de src/lib/prisma.ts).
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const VINCULO_ID = "cmp7la6an000404l1wmdtqj0a"; // Igor ↔ Igor
const VALOR_TESTE = 1000;
const DIA_VENCIMENTO = 5;
const OBS = "(Valor de teste — substituir pelo definitivo)";

function competenciaDoMes(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function calcularVencimento(competencia: string, diaVencimento: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(diaVencimento || 5, ultimoDia);
  return new Date(ano, mes - 1, dia);
}

async function main() {
  const v = await prisma.vinculoAnalista.findUnique({
    where: { id: VINCULO_ID },
    include: { analista: { select: { id: true, nomeCompleto: true } } },
  });
  if (!v) throw new Error("Vínculo não encontrado");

  console.log(`▸ Antes:  fixo=R$ ${v.fixoMensal.toFixed(2)}, dia=${v.diaVencimentoFixo}, obs="${v.observacoes ?? ""}"`);

  const atualizado = await prisma.vinculoAnalista.update({
    where: { id: VINCULO_ID },
    data: {
      fixoMensal: VALOR_TESTE,
      diaVencimentoFixo: DIA_VENCIMENTO,
      observacoes: OBS,
    },
  });
  console.log(`▸ Depois: fixo=R$ ${atualizado.fixoMensal.toFixed(2)}, dia=${atualizado.diaVencimentoFixo}, obs="${atualizado.observacoes}"`);

  // Gera linha do mês corrente já — idempotente, então safe.
  const competencia = competenciaDoMes();
  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { analistaId: v.analista.id, status: "ATIVO", fixoMensal: { gt: 0 } },
    select: { id: true, fixoMensal: true, diaVencimentoFixo: true },
  });
  let criadas = 0;
  for (const vin of vinculos) {
    try {
      await prisma.pagamentoFixoMensal.create({
        data: {
          vinculoId: vin.id,
          competencia,
          valor: vin.fixoMensal,
          vencimento: calcularVencimento(competencia, vin.diaVencimentoFixo),
          status: "A_RECEBER",
        },
      });
      criadas++;
    } catch (err) {
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }
  }
  console.log(`▸ Linhas do mês corrente criadas: ${criadas}`);
  console.log("\n✓ Igor já pode marcar pagamento da comissão fixa no painel dele.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
