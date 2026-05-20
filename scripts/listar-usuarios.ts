import { prisma } from "@/lib/prisma";

async function main() {
  const usuarios = await prisma.usuario.findMany({
    include: {
      conta: {
        select: {
          id: true,
          tipo: true,
          plano: true,
          statusAssinatura: true,
          empresas: { select: { razaoSocial: true, nomeFantasia: true } },
          analista: { select: { nomeCompleto: true } },
        },
      },
    },
    orderBy: [{ superAdmin: "desc" }, { criadoEm: "asc" }],
  });

  console.log(`\n=== ${usuarios.length} usuários no banco ===\n`);

  for (const u of usuarios) {
    const tag = u.superAdmin ? "👑 SUPER ADMIN" : "  USUÁRIO";
    const contaInfo =
      u.conta.tipo === "EMPRESA"
        ? u.conta.empresas[0]
          ? `${u.conta.empresas[0].nomeFantasia || u.conta.empresas[0].razaoSocial}`
          : "EMPRESA (sem empresa cadastrada)"
        : `Analista: ${u.conta.analista?.nomeCompleto ?? "?"}`;
    console.log(
      `${tag} | ${u.nome.padEnd(25)} | ${u.email.padEnd(35)} | ${u.conta.tipo.padEnd(8)} | ${contaInfo}`,
    );
  }

  const totalContas = await prisma.conta.count();
  const totalEmpresas = await prisma.empresa.count();
  const totalAtas = await prisma.ata.count();
  const totalContratos = await prisma.contrato.count();
  const totalEmpenhos = await prisma.empenho.count();

  console.log(`\n=== Volume total no banco ===`);
  console.log(`Contas:    ${totalContas}`);
  console.log(`Empresas:  ${totalEmpresas}`);
  console.log(`Atas:      ${totalAtas}`);
  console.log(`Contratos: ${totalContratos}`);
  console.log(`Empenhos:  ${totalEmpenhos}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
