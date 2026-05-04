import { Users } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EquipeClient } from "./EquipeClient";

export default async function EquipePage() {
  const usuario = await exigirUsuario();

  const membros = await prisma.usuario.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, nome: true, email: true, perfil: true, criadoEm: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100">
          <Users className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Equipe e perfis</h1>
          <p className="mt-1 text-sm text-slate-600">Gerencie os membros que acessam sua conta CP System.</p>
        </div>
      </div>

      <div className="mt-8">
        <EquipeClient membros={membros} meuId={usuario.id} ehAdmin={usuario.perfil === "ADMIN"} />
      </div>
    </div>
  );
}
