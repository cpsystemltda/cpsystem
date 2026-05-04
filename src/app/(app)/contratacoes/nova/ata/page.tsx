import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NovaAtaForm from "./NovaAtaForm";

export default async function Page() {
  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  });

  return (
    <NovaAtaForm
      empresas={empresas.map((e) => ({
        value: e.id,
        label: e.nomeFantasia || e.razaoSocial,
      }))}
    />
  );
}
