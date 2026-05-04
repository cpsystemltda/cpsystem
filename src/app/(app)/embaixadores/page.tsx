import { Sparkles } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmbaixadoresClient } from "./EmbaixadoresClient";

export default async function EmbaixadoresPage() {
  const usuario = await exigirUsuario();

  const analistasRaw = await prisma.analista.findMany({
    orderBy: { nomeCompleto: "asc" },
    include: {
      _count: { select: { contasIndicadas: { where: { statusAssinatura: "ATIVA" } } } },
    },
  });

  const analistas = analistasRaw.map((a) => ({
    id: a.id,
    nomeCompleto: a.nomeCompleto,
    cpf: a.cpf,
    telefone: a.telefone,
    email: a.email,
    pix: a.pix,
    ativo: a.ativo,
    totalAtivos: a._count.contasIndicadas,
  }));

  const comissoes = await prisma.comissao.findMany({
    orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
    take: 100,
    include: {
      analista: { select: { nomeCompleto: true } },
      conta: { select: { plano: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50">
          <Sparkles className="h-5 w-5 text-violet-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Programa de embaixadores</h1>
          <p className="mt-1 text-sm text-slate-600">
            Analistas de licitação parceiros · comissão recorrente por tier (Bronze 3% / Prata 4% / Ouro 5% / Diamond 6%).
          </p>
        </div>
      </div>

      <div className="mt-8">
        <EmbaixadoresClient analistas={analistas} comissoes={comissoes} podeAdministrar={usuario.perfil === "ADMIN"} />
      </div>
    </div>
  );
}
