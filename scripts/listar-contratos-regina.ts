/**
 * Lista todos os contratos/atas/empenhos da conta da Regina Luíza
 * (CNPJ 42736317000130) — identifica os DEMO pra remoção.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/listar-contratos-regina.ts
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
    select: { id: true, razaoSocial: true, nomeFantasia: true, contaId: true },
  });
  if (!empresa) {
    console.log("Empresa não encontrada");
    return;
  }
  console.log(`\nEmpresa: ${empresa.nomeFantasia || empresa.razaoSocial} (${empresa.contaId})\n`);

  const [atas, contratos, empenhos] = await Promise.all([
    prisma.ata.findMany({
      where: { empresaId: empresa.id },
      select: { id: true, numero: true, orgaoNome: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.contrato.findMany({
      where: { empresaId: empresa.id },
      select: { id: true, numero: true, orgaoNome: true, valorInicial: true, vigenciaFim: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.empenho.findMany({
      where: { empresaId: empresa.id },
      select: { id: true, numero: true, orgaoNome: true, status: true, instrumento: true, criadoEm: true },
      orderBy: { criadoEm: "desc" },
    }),
  ]);

  console.log(`=== ATAS (${atas.length}) ===`);
  for (const a of atas) {
    const demo = a.numero.startsWith("DEMO") || a.orgaoNome.toLowerCase().includes("demo");
    console.log(`${demo ? "🧪 DEMO" : "  REAL"} | ${a.numero} | ${a.orgaoNome} | ${a.criadoEm.toLocaleDateString("pt-BR")}`);
  }

  console.log(`\n=== CONTRATOS (${contratos.length}) ===`);
  for (const c of contratos) {
    const demo = c.numero.startsWith("DEMO");
    console.log(`${demo ? "🧪 DEMO" : "  REAL"} | ${c.numero} | ${c.orgaoNome} | valor=${c.valorInicial?.toFixed(2) ?? "—"} | ${c.criadoEm.toLocaleDateString("pt-BR")}`);
  }

  console.log(`\n=== EMPENHOS (${empenhos.length}) ===`);
  for (const e of empenhos) {
    const demo = e.numero.startsWith("DEMO") || e.orgaoNome.toLowerCase().includes("demo");
    console.log(`${demo ? "🧪 DEMO" : "  REAL"} | ${e.instrumento} ${e.numero} | ${e.orgaoNome} | ${e.status} | ${e.criadoEm.toLocaleDateString("pt-BR")}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
