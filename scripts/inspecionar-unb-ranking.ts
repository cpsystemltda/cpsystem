/**
 * Diagnóstico: por que Universidade de Brasília aparece com R$ 63.100 no
 * ranking "valor contratado" da Regina. Lista contratos + atas + empenhos
 * da UnB pra entender o que está sendo somado.
 *
 * Rodar: DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/inspecionar-unb-ranking.ts
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
    select: { id: true, contaId: true },
  });
  if (!empresa) throw new Error("Empresa Regina não encontrada");

  const hoje = new Date();
  console.log(`Hoje: ${hoje.toISOString().slice(0, 10)}\n`);

  // Atas
  const atas = await prisma.ata.findMany({
    where: { empresaId: empresa.id, orgaoNome: { contains: "Bras", mode: "insensitive" } },
    include: { itens: { select: { valorTotal: true } } },
  });
  console.log(`=== ATAS UnB (${atas.length}) ===`);
  for (const a of atas) {
    const tot = a.itens.reduce((s, it) => s + it.valorTotal, 0);
    const vigente = a.vigenciaFim >= hoje;
    console.log(`  ${a.numero} | vig.fim=${a.vigenciaFim.toISOString().slice(0, 10)} ${vigente ? "VIGENTE" : "vencida"} | ${a.itens.length} itens | R$ ${brl(tot)}`);
  }

  // Contratos
  const contratos = await prisma.contrato.findMany({
    where: { empresaId: empresa.id, orgaoNome: { contains: "Bras", mode: "insensitive" } },
    include: { itens: { select: { valorTotal: true } } },
  });
  console.log(`\n=== CONTRATOS UnB (${contratos.length}) ===`);
  for (const c of contratos) {
    const tot = c.itens.reduce((s, it) => s + it.valorTotal, 0);
    const vigente = c.vigenciaFim >= hoje;
    console.log(`  ${c.numero} | vig.fim=${c.vigenciaFim.toISOString().slice(0, 10)} ${vigente ? "VIGENTE" : "VENCIDO"} | valorInicial=${c.valorInicial?.toFixed(2) ?? "null"} | ${c.itens.length} itens | soma R$ ${brl(tot)}`);
  }

  // Empenhos
  const empenhos = await prisma.empenho.findMany({
    where: { empresaId: empresa.id, orgaoNome: { contains: "Bras", mode: "insensitive" } },
    select: {
      id: true, numero: true, status: true, instrumento: true,
      ataId: true, contratoId: true,
      itens: { select: { valorTotal: true } },
    },
  });
  console.log(`\n=== EMPENHOS UnB (${empenhos.length}) ===`);
  let totEmpenhos = 0;
  let totLivres = 0;
  for (const e of empenhos) {
    const tot = e.itens.reduce((s, it) => s + it.valorTotal, 0);
    const origem = e.ataId ? `ata=${e.ataId}` : e.contratoId ? `contrato=${e.contratoId}` : "LIVRE";
    console.log(`  ${e.numero} | ${e.status} | ${origem} | R$ ${brl(tot)}`);
    totEmpenhos += tot;
    if (!e.ataId && !e.contratoId) totLivres += tot;
  }
  console.log(`Total empenhos: ${brl(totEmpenhos)} (livres: ${brl(totLivres)})`);

  // O que o ranking SOMA hoje
  const valorRankingAtual =
    atas.filter((a) => a.vigenciaFim >= hoje).reduce((s, a) => s + a.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0) +
    contratos.filter((c) => c.vigenciaFim >= hoje).reduce((s, c) => s + c.itens.reduce((ss, it) => ss + it.valorTotal, 0), 0) +
    totEmpenhos;
  console.log(`\n=== Valor ranking HOJE (atas vig + contratos vig + TODOS empenhos): ${brl(valorRankingAtual)} ===`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
