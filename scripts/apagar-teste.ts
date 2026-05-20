import { prisma } from "@/lib/prisma";

async function main() {
  // Lista os usuários NÃO super admin agrupados por contaId
  const usuariosNaoAdmin = await prisma.usuario.findMany({
    where: { superAdmin: false },
    select: { id: true, nome: true, email: true, contaId: true },
  });

  if (usuariosNaoAdmin.length === 0) {
    console.log("Nenhuma conta de teste pra apagar. Banco limpo.");
    return;
  }

  // Apaga as CONTAS dos usuários não-admin (cascade derruba tudo:
  // usuários, empresas, analista, atas, contratos, empenhos, sessões…)
  const contaIds = Array.from(new Set(usuariosNaoAdmin.map((u) => u.contaId)));

  console.log(`\nVai apagar ${contaIds.length} conta(s):`);
  for (const u of usuariosNaoAdmin) {
    console.log(`  - ${u.nome} (${u.email})`);
  }

  const r = await prisma.conta.deleteMany({ where: { id: { in: contaIds } } });
  console.log(`\n✓ ${r.count} conta(s) apagada(s).`);

  // Resumo final
  const restantes = await prisma.usuario.findMany({
    where: { superAdmin: true },
    select: { nome: true, email: true },
  });
  console.log(`\nUsuários restantes (super admins):`);
  for (const u of restantes) {
    console.log(`  👑 ${u.nome} — ${u.email}`);
  }

  const totalEmpresas = await prisma.empresa.count();
  const totalAtas = await prisma.ata.count();
  const totalContratos = await prisma.contrato.count();
  const totalEmpenhos = await prisma.empenho.count();
  console.log(`\nVolume restante: ${totalEmpresas} empresas · ${totalAtas} atas · ${totalContratos} contratos · ${totalEmpenhos} empenhos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
