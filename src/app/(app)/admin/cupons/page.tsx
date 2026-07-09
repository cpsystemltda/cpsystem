import Link from "next/link";
import { Ticket, ArrowLeft } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { CuponsClient } from "./CuponsClient";

// Painel admin de cupons (Regina 09/07).
// Cria cupons personalizados: trial estendido + vincula analista.
// Uso típico: Igor pede pra você gerar um cupom pro cliente novo dele.
export default async function CuponsPage() {
  const usuario = await exigirUsuario();
  const podeVer = usuario.perfil === "ADMIN" || usuario.superAdmin;
  if (!podeVer) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Área restrita</h1>
        <p className="mt-2 text-sm text-slate-600">
          Apenas administradores podem gerenciar cupons.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-violet-700 underline">
          Voltar
        </Link>
      </div>
    );
  }

  const [cupons, analistas] = await Promise.all([
    prisma.cupom.findMany({
      orderBy: { criadoEm: "desc" },
      include: {
        analistaVinculado: { select: { id: true, nomeCompleto: true } },
        criadoPor: { select: { nome: true } },
        _count: { select: { contasAplicadas: true } },
      },
    }),
    prisma.analista.findMany({
      where: { ativo: true },
      orderBy: { nomeCompleto: "asc" },
      select: { id: true, nomeCompleto: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3 w-3" /> Voltar ao dashboard
        </Link>
      </div>
      <PageHeader
        eyebrow="Admin · Cupons"
        titulo="Cupons"
        destaque="promocionais"
        subtitulo="Trial estendido + vínculo automático de analista. Cria um cupom, passa pro cliente, ele aplica no signup."
      />

      <div className="mt-8">
        <CuponsClient
          cupons={cupons.map((c) => ({
            id: c.id,
            codigo: c.codigo,
            descricao: c.descricao,
            diasTrial: c.diasTrial,
            analistaVinculado: c.analistaVinculado?.nomeCompleto ?? null,
            validoAte: c.validoAte?.toISOString() ?? null,
            usosMaximos: c.usosMaximos,
            usosAtuais: c.usosAtuais,
            ativo: c.ativo,
            criadoEm: c.criadoEm.toISOString(),
            criadoPor: c.criadoPor?.nome ?? null,
            contasAplicadas: c._count.contasAplicadas,
          }))}
          analistas={analistas}
        />
      </div>
    </div>
  );
}

// Ícone da página no dashboard
export const metadata = {
  title: "Cupons · Admin · CP System",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _iconePreload() {
  return <Ticket />;
}
