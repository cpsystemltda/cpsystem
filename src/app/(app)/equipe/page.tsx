import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipeClient } from "./EquipeClient";
import { PageHeader } from "@/components/ui/SecaoGlass";

export default async function EquipePage() {
  const usuario = await exigirUsuario();

  const membros = await prisma.usuario.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      criadoEm: true,
      acessoRestrito: true,
      modulosPermitidos: true,
    },
  });

  // Titular = o usuario mais antigo da conta. Ele nunca e restringido: e quem
  // administra os acessos dos outros, entao tirar o dele trancaria a conta.
  const titularId = membros[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Acessos"
        titulo="Equipe e"
        destaque="níveis de acesso"
        subtitulo="Cadastre colaboradores para dividir a operação e escolha, módulo a módulo, o que cada um enxerga."
      />

      <div className="mt-8">
        <EquipeClient
          membros={membros}
          meuId={usuario.id}
          ehAdmin={usuario.perfil === "ADMIN"}
          titularId={titularId}
        />
      </div>
    </div>
  );
}
