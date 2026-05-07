/**
 * Idempotente: garante que igor@contratospublicos.com.br exista como super admin
 * com a senha pedida. Se já existe, atualiza senha + flags. Se não existe, cria.
 *
 * Uso: tsx scripts/ensure-igor-super-admin.ts
 *      (lê DATABASE_URL do ambiente — passe via dotenv-cli ou export)
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const EMAIL = "igor@contratospublicos.com.br";
const SENHA = "senha-forte-12345";
const NOME = "Igor Fernandes";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const senhaHash = await bcrypt.hash(SENHA, 12);

  const existente = await prisma.usuario.findUnique({
    where: { email: EMAIL.toLowerCase() },
    include: { conta: true },
  });

  if (existente) {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        nome: NOME,
        senhaHash,
        perfil: "ADMIN",
        superAdmin: true,
        emailVerificadoEm: new Date(),
      },
    });
    await prisma.conta.update({
      where: { id: existente.contaId },
      data: {
        plano: "PREMIUM",
        statusAssinatura: "ATIVA",
        termosAceitosEm: new Date(),
      },
    });
    console.log(`✅ Atualizado: ${EMAIL} (já era super admin: ${existente.superAdmin})`);
    console.log(`   contaId: ${existente.contaId}, userId: ${existente.id}`);
  } else {
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
    console.log(`✅ Criado: ${EMAIL}`);
    console.log(`   contaId: ${conta.id}, userId: ${usuario.id}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
