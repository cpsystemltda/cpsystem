/**
 * Limpeza de contas de teste + empresas DEMO da conta Regina.
 *
 * O que faz:
 *  1. Deleta contas dos 2 Igors de teste (cascata via Prisma onDelete):
 *     - igorfernandes3786@gmail.com
 *     - igorfernandes@contratospublicos.adv.br
 *  2. Deleta as 6 empresas DEMO da conta da Regina (e tudo vinculado a elas).
 *
 * Preserva:
 *  - Conta da Regina (super admin) + empresa real "REGINA LUIZA DA SILVA FERNANDES"
 *  - Conta do Igor super admin (igor@contratospublicos.com.br)
 *
 * Rodar:
 *   DATABASE_URL=$DATABASE_URL_UNPOOLED npx tsx scripts/limpar-contas-e-demos.ts
 */
import { prisma } from "@/lib/prisma";

const EMAILS_TESTE = [
  "igorfernandes3786@gmail.com",
  "igorfernandes@contratospublicos.adv.br",
];

const EMPRESA_DEMO_PREFIX = "DEMO";

async function main() {
  console.log("\n=== LIMPEZA: contas de teste do Igor + empresas DEMO ===\n");

  // 1) Contas de teste do Igor
  console.log("→ Excluindo contas de teste...");
  for (const email of EMAILS_TESTE) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { contaId: true, nome: true },
    });
    if (!usuario) {
      console.log(`  ⏭  ${email} — não encontrado.`);
      continue;
    }
    // Deletar a Conta cascateia: usuários, sessões, empresas, atas,
    // contratos, empenhos, analistas, etc.
    const deletado = await prisma.conta.delete({ where: { id: usuario.contaId } });
    console.log(`  ✓ ${email} (${usuario.nome}) — conta ${deletado.id} excluída.`);
  }

  // 2) Empresas DEMO da conta da Regina
  console.log("\n→ Excluindo empresas DEMO da conta da Regina...");
  const demos = await prisma.empresa.findMany({
    where: {
      razaoSocial: { startsWith: EMPRESA_DEMO_PREFIX },
    },
    select: { id: true, razaoSocial: true, cnpj: true, contaId: true },
  });
  console.log(`  ${demos.length} empresa(s) DEMO encontrada(s).`);

  for (const e of demos) {
    // Antes de deletar a empresa, conta o que será removido em cascata
    const [atas, contratos, empenhos, anexos] = await Promise.all([
      prisma.ata.count({ where: { empresaId: e.id } }),
      prisma.contrato.count({ where: { empresaId: e.id } }),
      prisma.empenho.count({ where: { empresaId: e.id } }),
      prisma.anexo.count({ where: { OR: [{ ata: { empresaId: e.id } }, { contrato: { empresaId: e.id } }, { empenho: { empresaId: e.id } }] } }),
    ]);
    await prisma.empresa.delete({ where: { id: e.id } });
    console.log(`  ✓ ${e.razaoSocial} (${e.cnpj})`);
    console.log(`     atas=${atas} · contratos=${contratos} · empenhos=${empenhos} · anexos=${anexos} (cascata)`);
  }

  // 3) Sanity: conta o que sobrou
  console.log("\n=== ESTADO FINAL ===");
  const contas = await prisma.conta.findMany({
    include: {
      usuarios: { select: { email: true, superAdmin: true } },
      empresas: { select: { razaoSocial: true, cnpj: true } },
    },
    orderBy: { criadoEm: "asc" },
  });
  for (const c of contas) {
    const sa = c.usuarios.some((u) => u.superAdmin) ? " [SUPER]" : "";
    console.log(`Conta ${c.id}${sa}`);
    for (const u of c.usuarios) console.log(`  └ ${u.email}`);
    for (const e of c.empresas) console.log(`     · ${e.razaoSocial} (${e.cnpj})`);
  }
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
