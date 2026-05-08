import { Users } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipeClient } from "./EquipeClient";
import { PageHeader } from "@/components/ui/SecaoGlass";

export default async function EquipePage() {
  const usuario = await exigirUsuario();

  const membros = await prisma.usuario.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, email: true, perfil: true, criadoEm: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <PageHeader
        eyebrow="Conta · Acessos"
        titulo="Equipe e"
        destaque="perfis"
        subtitulo="Gerencie os membros que acessam sua conta CP System."
      />

      <div className="mt-8">
        <EquipeClient membros={membros} meuId={usuario.id} ehAdmin={usuario.perfil === "ADMIN"} />
      </div>
    </div>
  );
}
