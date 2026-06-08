import { Sparkles } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmbaixadoresClient } from "./EmbaixadoresClient";
import { PageHeader } from "@/components/ui/SecaoGlass";

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
      <PageHeader
        eyebrow="Conta · Programa de parceiros"
        titulo="Programa de"
        destaque="embaixadores"
        subtitulo="Analistas de licitação parceiros · comissão recorrente por tier (Bronze 5% / Prata 7% / Ouro 10% / Diamante 15%) + R$ 500 fixo na 1ª paga + R$ 5k/ano Diamante."
      />

      <div className="mt-8">
        <EmbaixadoresClient analistas={analistas} comissoes={comissoes} podeAdministrar={usuario.perfil === "ADMIN"} />
      </div>
    </div>
  );
}
