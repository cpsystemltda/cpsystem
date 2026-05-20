/**
 * Apaga os 5 vínculos de teste da empresa "Regina Luíza" (CNPJ 42736317000130).
 * Cascade: também apaga PagamentoFixoMensal e ComissaoExecucao associados
 * a esses vínculos (foreign keys com onDelete: Cascade).
 *
 * Confirmado pela Regina em 2026-05-20 via AskUserQuestion.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/apagar-vinculos-teste-regina.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CNPJ_REGINA = "42736317000130";

async function main() {
  const empresa = await prisma.empresa.findUnique({
    where: { cnpj: CNPJ_REGINA },
    select: { contaId: true },
  });
  if (!empresa) throw new Error("Empresa Regina Luíza não encontrada");

  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { contaId: empresa.contaId },
    select: { id: true, analista: { select: { nomeCompleto: true } } },
  });
  console.log(`Vínculos a apagar: ${vinculos.length}`);
  vinculos.forEach((v) => console.log(`  - ${v.analista.nomeCompleto} (${v.id})`));

  // Conta antes
  const ids = vinculos.map((v) => v.id);
  const fixosAntes = await prisma.pagamentoFixoMensal.count({ where: { vinculoId: { in: ids } } });
  const variaveisAntes = await prisma.comissaoExecucao.count({ where: { vinculoId: { in: ids } } });
  console.log(`\nCascade vai apagar:`);
  console.log(`  ${fixosAntes} linha(s) de PagamentoFixoMensal`);
  console.log(`  ${variaveisAntes} linha(s) de ComissaoExecucao`);

  console.log("\nExecutando...");
  const r = await prisma.vinculoAnalista.deleteMany({ where: { id: { in: ids } } });
  console.log(`✓ ${r.count} vínculo(s) deletado(s) (com cascade nas tabelas dependentes).`);

  // Confirma vazio
  const restantes = await prisma.vinculoAnalista.count({ where: { contaId: empresa.contaId } });
  console.log(`\nVínculos restantes na conta Regina Luíza: ${restantes}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
