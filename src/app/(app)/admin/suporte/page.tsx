import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { ChamadoCard } from "./ChamadoCard";

export default async function AdminSuportePage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Somente super admin.</p>
      </div>
    );
  }

  const chamados = await prisma.chamadoSuporte.findMany({
    where: { status: { in: ["ABERTO", "IA_ANALISANDO", "AGUARDANDO_ADMIN", "EM_IMPLEMENTACAO"] } },
    orderBy: { criadoEm: "desc" },
    take: 50,
    include: {
      usuario: { select: { nome: true, email: true, telefoneWhatsApp: true } },
      conta: { select: { tipo: true, empresas: { select: { razaoSocial: true }, take: 1 } } },
      mensagens: { orderBy: { criadoEm: "asc" } },
    },
  });

  const resolvidosRecentes = await prisma.chamadoSuporte.findMany({
    where: { status: { in: ["IA_RESOLVEU", "RESOLVIDO_ADMIN", "RECUSADO"] } },
    orderBy: { atualizadoEm: "desc" },
    take: 10,
    include: {
      usuario: { select: { nome: true, email: true } },
      conta: { select: { tipo: true } },
    },
  });

  const contagens = {
    aguardando: chamados.filter((c) => c.status === "AGUARDANDO_ADMIN").length,
    ia: chamados.filter((c) => c.status === "IA_ANALISANDO" || c.status === "ABERTO").length,
    implementando: chamados.filter((c) => c.status === "EM_IMPLEMENTACAO").length,
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <PageHeader
        eyebrow="Admin · Suporte"
        titulo="Chamados"
        destaque="pendentes"
        subtitulo="Mensagens de clientes que exigem sua atenção — a IA responde direto as fáceis, aqui só o que ela escalou."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Kpi cor="rose" titulo="Aguardando você" valor={contagens.aguardando} />
        <Kpi cor="amber" titulo="Em análise IA" valor={contagens.ia} />
        <Kpi cor="violet" titulo="Em implementação" valor={contagens.implementando} />
      </div>

      <div className="mt-8 space-y-4">
        {chamados.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Nenhum chamado pendente. 🎉
          </div>
        ) : (
          chamados.map((c) => (
            <ChamadoCard
              key={c.id}
              chamado={{
                id: c.id,
                categoria: c.categoria,
                titulo: c.titulo,
                descricao: c.descricao,
                status: c.status,
                respostaIA: c.respostaIA ?? null,
                iaAcaoResumo: c.iaAcaoResumo ?? null,
                criadoEm: c.criadoEm.toISOString(),
                cliente: {
                  nome: c.usuario.nome,
                  email: c.usuario.email,
                  telefone: c.usuario.telefoneWhatsApp ?? "",
                  tipoConta: c.conta.tipo,
                  empresa: c.conta.empresas[0]?.razaoSocial,
                },
                mensagens: c.mensagens.map((m) => ({
                  autor: m.autor,
                  conteudo: m.conteudo,
                  criadoEm: m.criadoEm.toISOString(),
                })),
              }}
            />
          ))
        )}
      </div>

      {resolvidosRecentes.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Resolvidos recentemente</h2>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {resolvidosRecentes.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{c.titulo}</p>
                  <p className="text-xs text-slate-500">
                    {c.usuario.nome} · {c.conta.tipo} · {c.status === "IA_RESOLVEU" ? "IA resolveu" : c.status === "RECUSADO" ? "Recusado" : "Admin resolveu"}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{new Date(c.atualizadoEm).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ cor, titulo, valor }: { cor: "rose" | "amber" | "violet"; titulo: string; valor: number }) {
  const cores = {
    rose: { bg: "rgba(244,63,94,0.08)", border: "rgba(244,63,94,0.3)", txt: "#be123c" },
    amber: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", txt: "#92400e" },
    violet: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)", txt: "#5b21b6" },
  }[cor];
  return (
    <div className="rounded-2xl p-4" style={{ background: cores.bg, border: `1px solid ${cores.border}` }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: cores.txt }}>{titulo}</p>
      <p className="mt-1 text-3xl font-extrabold" style={{ color: cores.txt }}>{valor}</p>
    </div>
  );
}
