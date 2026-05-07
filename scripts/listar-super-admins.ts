import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const supers = await prisma.usuario.findMany({
    where: { superAdmin: true },
    select: { id: true, email: true, nome: true, perfil: true, contaId: true, criadoEm: true },
  });
  console.log(`Super admins (${supers.length}):`);
  for (const u of supers) {
    console.log(`  - ${u.email} | ${u.nome} | perfil ${u.perfil} | conta ${u.contaId} | criado ${u.criadoEm.toISOString()}`);
  }

  const totalUsuarios = await prisma.usuario.count();
  const totalContas = await prisma.conta.count();
  const totalEmpresas = await prisma.empresa.count();
  const totalAtas = await prisma.ata.count();
  const totalContratos = await prisma.contrato.count();
  console.log(`\nTotais no banco:`);
  console.log(`  usuarios: ${totalUsuarios} (super: ${supers.length})`);
  console.log(`  contas: ${totalContas}`);
  console.log(`  empresas: ${totalEmpresas}`);
  console.log(`  atas: ${totalAtas}`);
  console.log(`  contratos: ${totalContratos}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
