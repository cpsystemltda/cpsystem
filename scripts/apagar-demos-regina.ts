/**
 * Apaga todos os dados de demonstração da conta da Regina Luíza:
 * - 1 Ata: DEMO-ATA-001/2026
 * - 1 Ata: TESTE-FUTURO/2026 (órgão "Órgão Teste — Validação de Dashboard")
 * - 4 Contratos: DEMO-001, DEMO-008, DEMO-015, DEMO-022 (todos no TCU)
 * - 2 Empenhos: DEMO-2026NE000100, DEMO-2026NE000107
 *
 * Ordem de deleção respeitando FKs:
 *   empenhos → contratos → atas
 * (Empenho→Contrato e Empenho→Ata são relações opcionais sem CASCADE,
 * então precisa apagar manualmente nessa ordem.)
 *
 * Confirmado pela Regina em 2026-05-21.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/apagar-demos-regina.ts
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
    select: { id: true },
  });
  if (!empresa) throw new Error("Empresa não encontrada");

  // Filtros: tudo que começa com "DEMO" + ata TESTE-FUTURO + órgão de teste
  const filtroDemo = {
    empresaId: empresa.id,
    OR: [
      { numero: { startsWith: "DEMO" } },
      { numero: { startsWith: "TESTE-" } },
      { orgaoNome: { contains: "Demo", mode: "insensitive" as const } },
      { orgaoNome: { contains: "Teste", mode: "insensitive" as const } },
    ],
  };

  // 1) Lista o que vai apagar
  const [atasAlvo, contratosAlvo, empenhosAlvo] = await Promise.all([
    prisma.ata.findMany({ where: filtroDemo, select: { id: true, numero: true, orgaoNome: true } }),
    prisma.contrato.findMany({ where: filtroDemo, select: { id: true, numero: true, orgaoNome: true } }),
    prisma.empenho.findMany({ where: filtroDemo, select: { id: true, numero: true, orgaoNome: true } }),
  ]);

  console.log("\nVai apagar:");
  console.log(`  Atas (${atasAlvo.length}):`);
  atasAlvo.forEach((a) => console.log(`    - ${a.numero} | ${a.orgaoNome}`));
  console.log(`  Contratos (${contratosAlvo.length}):`);
  contratosAlvo.forEach((c) => console.log(`    - ${c.numero} | ${c.orgaoNome}`));
  console.log(`  Empenhos (${empenhosAlvo.length}):`);
  empenhosAlvo.forEach((e) => console.log(`    - ${e.numero} | ${e.orgaoNome}`));

  // 2) Deleção em cascata respeitando FKs
  console.log("\nExecutando...");
  const rE = await prisma.empenho.deleteMany({ where: { id: { in: empenhosAlvo.map((e) => e.id) } } });
  console.log(`  ✓ ${rE.count} empenhos apagados`);
  const rC = await prisma.contrato.deleteMany({ where: { id: { in: contratosAlvo.map((c) => c.id) } } });
  console.log(`  ✓ ${rC.count} contratos apagados`);
  const rA = await prisma.ata.deleteMany({ where: { id: { in: atasAlvo.map((a) => a.id) } } });
  console.log(`  ✓ ${rA.count} atas apagadas`);

  // 3) Confirma estado final
  const [aFinal, cFinal, eFinal] = await Promise.all([
    prisma.ata.findMany({ where: { empresaId: empresa.id }, select: { numero: true, orgaoNome: true } }),
    prisma.contrato.findMany({ where: { empresaId: empresa.id }, select: { numero: true, orgaoNome: true } }),
    prisma.empenho.findMany({ where: { empresaId: empresa.id }, select: { numero: true, orgaoNome: true } }),
  ]);
  console.log(`\nRestam na conta da Regina:`);
  console.log(`  Atas (${aFinal.length}):`);
  aFinal.forEach((a) => console.log(`    - ${a.numero} | ${a.orgaoNome}`));
  console.log(`  Contratos (${cFinal.length}):`);
  cFinal.forEach((c) => console.log(`    - ${c.numero} | ${c.orgaoNome}`));
  console.log(`  Empenhos (${eFinal.length}):`);
  eFinal.forEach((e) => console.log(`    - ${e.numero} | ${e.orgaoNome}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
