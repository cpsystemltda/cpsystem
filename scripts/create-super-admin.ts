import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const EMAIL = process.argv[2];
const SENHA = process.argv[3];
const NOME = process.argv[4] ?? "Super Admin";

if (!EMAIL || !SENHA) {
  console.error("Uso: tsx scripts/create-super-admin.ts <email> <senha> [nome]");
  process.exit(1);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const senhaHash = await bcrypt.hash(SENHA, 12);

  const conta = await prisma.conta.create({
    data: {
      tipo: "EMPRESA",
      plano: "PREMIUM",
      statusAssinatura: "ATIVA",
      termosAceitosEm: new Date(),
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      nome: NOME,
      email: EMAIL.toLowerCase(),
      senhaHash,
      perfil: "ADMIN",
      superAdmin: true,
      emailVerificadoEm: new Date(),
      contaId: conta.id,
    },
  });

  console.log("Super admin criado:");
  console.log(`  Email: ${usuario.email}`);
  console.log(`  Nome: ${usuario.nome}`);
  console.log(`  superAdmin: ${usuario.superAdmin}`);
  console.log(`  contaId: ${conta.id}`);
  console.log(`  userId: ${usuario.id}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
