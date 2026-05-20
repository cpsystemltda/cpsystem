/**
 * Lista todas as contas + usuários pra revisar antes de excluir
 * logins de teste.
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/listar-contas-teste.ts
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const contas = await prisma.conta.findMany({
    include: {
      usuarios: {
        select: { id: true, nome: true, email: true, superAdmin: true, criadoEm: true },
      },
      empresas: { select: { id: true, razaoSocial: true, cnpj: true } },
    },
    orderBy: { criadoEm: "asc" },
  });

  console.log(`\n=== ${contas.length} CONTAS NO SISTEMA ===\n`);
  for (const c of contas) {
    const flagSuper = c.usuarios.some((u) => u.superAdmin) ? " [SUPER ADMIN]" : "";
    console.log(`Conta ${c.id}${flagSuper}`);
    console.log(`  plano: ${c.plano} · status: ${c.statusAssinatura} · criada: ${c.criadoEm.toISOString().slice(0, 10)}`);
    for (const u of c.usuarios) {
      const flag = u.superAdmin ? " 🛡️ SUPER" : "";
      console.log(`  └ ${u.nome} <${u.email}>${flag}`);
    }
    if (c.empresas.length > 0) {
      console.log(`  └ ${c.empresas.length} empresa(s):`);
      for (const e of c.empresas) {
        console.log(`     · ${e.razaoSocial} (${e.cnpj})`);
      }
    }
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
