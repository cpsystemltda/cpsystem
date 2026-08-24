// SOMENTE LEITURA — cobranças das contas de super admin.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const contas = await prisma.conta.findMany({
    where: { usuarios: { some: { superAdmin: true } } },
    select: {
      id: true, tipo: true, plano: true, statusAssinatura: true, criadoEm: true,
      proximoVencimento: true, trialAteEm: true, diaVencimento: true,
      gatewayCustomerId: true, gatewaySubscriptionId: true, gatewayProvider: true,
      usuarios: { select: { email: true, superAdmin: true } },
      empresas: { select: { razaoSocial: true, cnpj: true } },
      cobrancas: { orderBy: { criadaEm: "desc" } },
      metodosPagamento: { select: { forma: true, apelido: true, ativo: true } },
    },
  });
  for (const c of contas) {
    console.log(`\n=== CONTA ${c.id}`);
    console.log(`  emails: ${c.usuarios.map(u => `${u.email}${u.superAdmin ? " [SUPER ADMIN]" : ""}`).join(" | ")}`);
    console.log(`  empresa: ${c.empresas.map(e => e.razaoSocial).join(", ") || "—"}`);
    console.log(`  plano=${c.plano} status=${c.statusAssinatura} criadoEm=${c.criadoEm.toISOString().slice(0,10)}`);
    console.log(`  proximoVencimento=${c.proximoVencimento?.toISOString().slice(0,10) ?? "-"} diaVencimento=${c.diaVencimento ?? "-"} trialAteEm=${c.trialAteEm?.toISOString().slice(0,10) ?? "-"}`);
    console.log(`  gateway: provider=${c.gatewayProvider ?? "-"} customer=${c.gatewayCustomerId ?? "-"} subscription=${c.gatewaySubscriptionId ?? "-"}`);
    console.log(`  metodos: ${c.metodosPagamento.map(m => `${m.forma}/${m.apelido}${m.ativo ? "" : " (inativo)"}`).join(" | ") || "nenhum"}`);
    console.log(`  COBRANCAS (${c.cobrancas.length}):`);
    for (const cb of c.cobrancas) {
      console.log(`   - ${cb.criadaEm.toISOString().slice(0,10)} comp=${cb.competencia} ${cb.forma} R$${cb.valor} ${cb.status} venc=${cb.vencimento.toISOString().slice(0,10)} chargeId=${cb.gatewayChargeId ?? "-"} pagaEm=${cb.pagaEm?.toISOString().slice(0,10) ?? "-"} obs=${cb.observacoes ?? "-"}`);
    }
  }
  const totalCobrancas = await prisma.cobranca.count();
  console.log(`\nTOTAL DE COBRANCAS NA BASE: ${totalCobrancas}`);
}
main().finally(() => prisma.$disconnect());
