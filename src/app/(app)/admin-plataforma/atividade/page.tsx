import Link from "next/link";
import { Crown, Activity } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROTULO_ACAO: Record<string, string> = {
  CRIAR: "Criou",
  ATUALIZAR: "Atualizou",
  EXCLUIR: "Excluiu",
  EXPORTAR: "Exportou",
  AVANCAR_STATUS: "Avançou status de",
  LOGIN: "Entrou na conta",
  LOGOUT: "Saiu da conta",
};

const COR_ACAO: Record<string, string> = {
  CRIAR: "bg-emerald-100 text-emerald-700",
  ATUALIZAR: "bg-amber-100 text-amber-700",
  EXCLUIR: "bg-red-100 text-red-700",
  EXPORTAR: "bg-blue-100 text-blue-700",
  AVANCAR_STATUS: "bg-violet-100 text-violet-700",
  LOGIN: "bg-slate-100 text-slate-600",
  LOGOUT: "bg-slate-100 text-slate-600",
};

export default async function AdminAtividadePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Esta área é exclusiva para gestores da plataforma.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const q = (sp.q || "").trim();

  const eventos = await prisma.logAuditoria.findMany({
    where: {
      // Ignora atividade dos super admins (Igor/Regina) — atividade é
      // pra monitorar uso dos clientes, não dos próprios gestores.
      conta: { usuarios: { none: { superAdmin: true } } },
      ...(q && {
        OR: [
          { recurso: { contains: q, mode: "insensitive" } },
          { resumo: { contains: q, mode: "insensitive" } },
        ],
      }),
    },
    take: 200,
    orderBy: { criadoEm: "desc" },
  });

  // Carrega contas e usuários referenciados em UMA query cada
  const contaIds = Array.from(new Set(eventos.map((e) => e.contaId)));
  const usuarioIds = Array.from(new Set(eventos.map((e) => e.usuarioId).filter(Boolean) as string[]));
  const [contas, usuarios] = await Promise.all([
    prisma.conta.findMany({
      where: { id: { in: contaIds } },
      select: { id: true, tipo: true, empresas: { select: { nomeFantasia: true, razaoSocial: true } }, analista: { select: { nomeCompleto: true } } },
    }),
    prisma.usuario.findMany({
      where: { id: { in: usuarioIds } },
      select: { id: true, nome: true, email: true },
    }),
  ]);
  const mapaContas = new Map(contas.map((c) => [c.id, c]));
  const mapaUsuarios = new Map(usuarios.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Atividade
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Auditoria de toda a plataforma
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Últimos 200 eventos de todos os clientes — quem fez, o quê, em que conta e quando.
          </p>
        </div>
        <Link href="/admin-plataforma" className="text-sm text-slate-600 hover:text-slate-900">
          ← Voltar à visão geral
        </Link>
      </div>

      <form method="get" className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Filtrar por usuário, recurso, ação ou resumo..."
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Quando</th>
              <th className="px-4 py-3 text-left font-medium">Conta</th>
              <th className="px-4 py-3 text-left font-medium">Usuário</th>
              <th className="px-4 py-3 text-left font-medium">Ação</th>
              <th className="px-4 py-3 text-left font-medium">Recurso</th>
              <th className="px-4 py-3 text-left font-medium">Resumo</th>
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                  Nenhum evento de auditoria encontrado.
                </td>
              </tr>
            ) : (
              eventos.map((e) => {
                const c = mapaContas.get(e.contaId);
                const conta =
                  c?.tipo === "ANALISTA"
                    ? c.analista?.nomeCompleto || "Analista"
                    : c?.empresas[0]?.nomeFantasia || c?.empresas[0]?.razaoSocial || "—";
                const u = e.usuarioId ? mapaUsuarios.get(e.usuarioId) : null;
                const acaoCor = COR_ACAO[e.acao] || "bg-slate-100 text-slate-700";
                const acaoLabel = ROTULO_ACAO[e.acao] || e.acao;
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {e.criadoEm.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{conta}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {u?.nome || "—"}
                      {u?.email && (
                        <div className="text-[10px] text-slate-400">{u.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${acaoCor}`}>
                        {acaoLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{e.recurso}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{e.resumo || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
