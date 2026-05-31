import Link from "next/link";
import { Crown, Search, ArrowUpRight, AlertTriangle, CheckCircle2, Clock, XCircle, Eye, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { entrarEspionagemAction } from "@/lib/espionagem";
import { montarLabelEmpresa } from "@/lib/empresaLabel";

const PRECO_BASICO = 397;
const PRECO_PREMIUM = 997;

const STATUS_LABEL: Record<string, { rotulo: string; cor: string; bg: string; icone: React.ComponentType<{ className?: string }> }> = {
  TRIAL: { rotulo: "Trial", cor: "text-violet-700", bg: "bg-violet-100", icone: Clock },
  ATIVA: { rotulo: "Em dia", cor: "text-emerald-700", bg: "bg-emerald-100", icone: CheckCircle2 },
  INADIMPLENTE: { rotulo: "Inadimplente", cor: "text-red-700", bg: "bg-red-100", icone: AlertTriangle },
  CANCELADA: { rotulo: "Cancelada", cor: "text-slate-600", bg: "bg-slate-100", icone: XCircle },
};

const FILTROS_VALIDOS = ["TRIAL", "ATIVA", "INADIMPLENTE", "CANCELADA"] as const;

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; tipo?: string }>;
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
  const status = (sp.status || "").toUpperCase();
  const q = (sp.q || "").trim();
  const tipo = (sp.tipo || "").toUpperCase();

  const statusFiltro = (FILTROS_VALIDOS as readonly string[]).includes(status) ? status : null;

  const contas = await prisma.conta.findMany({
    where: {
      // Mostra todas as contas — inclusive as de super admin (Regina/Igor),
      // pra permitir entrar via modo espionagem se necessário. Linhas com
      // super admin recebem badge "Adm CP" pra distinguir.
      ...(statusFiltro && { statusAssinatura: statusFiltro as "TRIAL" | "ATIVA" | "INADIMPLENTE" | "CANCELADA" }),
      ...(tipo === "EMPRESA" && { tipo: "EMPRESA" }),
      ...(tipo === "ANALISTA" && { tipo: "ANALISTA" }),
      ...(q && {
        OR: [
          { empresas: { some: { OR: [
            { razaoSocial: { contains: q, mode: "insensitive" } },
            { nomeFantasia: { contains: q, mode: "insensitive" } },
            { cnpj: { contains: q.replace(/\D/g, "") } },
          ] } } },
          { analista: { OR: [
            { nomeCompleto: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ] } },
          { usuarios: { some: { email: { contains: q, mode: "insensitive" } } } },
        ],
      }),
    },
    include: {
      empresas: { select: { id: true, razaoSocial: true, nomeFantasia: true, responsavel: true, cnpj: true } },
      analista: { select: { nomeCompleto: true, email: true } },
      usuarios: { select: { id: true, email: true, superAdmin: true } },
      embaixador: { select: { nomeCompleto: true } },
      cobrancas: {
        select: { id: true, status: true, valor: true, vencimento: true, pagaEm: true },
        orderBy: { vencimento: "desc" },
        take: 12,
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Clientes
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Todos os assinantes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {contas.length} conta(s){statusFiltro ? ` no status "${STATUS_LABEL[statusFiltro].rotulo}"` : ""}{q ? ` correspondendo a "${q}"` : ""}.
          </p>
        </div>
        <Link
          href="/admin-plataforma"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Voltar à visão geral
        </Link>
      </div>

      {/* Filtros */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Razão social, CNPJ, e-mail, analista..."
            className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select name="tipo" defaultValue={tipo} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Todos os tipos</option>
          <option value="EMPRESA">Empresa</option>
          <option value="ANALISTA">Analista</option>
        </select>
        <select name="status" defaultValue={statusFiltro || ""} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Todos os status</option>
          <option value="TRIAL">Em trial</option>
          <option value="ATIVA">Em dia</option>
          <option value="INADIMPLENTE">Inadimplente</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      {/* Tabela */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Plano</th>
              <th className="px-4 py-3 text-right font-medium">MRR</th>
              <th className="px-4 py-3 text-left font-medium">Origem</th>
              <th className="px-4 py-3 text-left font-medium">Adimplência</th>
              <th className="px-4 py-3 text-left font-medium">Criada em</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => {
              const nome =
                c.tipo === "ANALISTA"
                  ? c.analista?.nomeCompleto || "Analista sem nome"
                  : c.empresas[0]
                    ? montarLabelEmpresa(c.empresas[0])
                    : "Sem empresa";
              const conf = STATUS_LABEL[c.statusAssinatura] || STATUS_LABEL.ATIVA;
              const Icon = conf.icone;
              const mrr = c.tipo === "ANALISTA" ? 0 : c.plano === "PREMIUM" ? PRECO_PREMIUM : PRECO_BASICO;
              const totalCob = c.cobrancas.length;
              const pagas = c.cobrancas.filter((cb) => cb.status === "PAGA").length;
              const adimplenciaPct = totalCob > 0 ? (pagas / totalCob) * 100 : null;
              const ehContaAdmin = c.usuarios.some((u) => u.superAdmin);
              const ehMinhaConta = c.usuarios.some((u) => u.id === usuario.id);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{nome}</span>
                      {ehContaAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          Adm CP
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.tipo === "EMPRESA" && c.empresas[0]?.cnpj
                        ? `CNPJ ${c.empresas[0].cnpj}`
                        : c.usuarios[0]?.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{c.tipo}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full ${conf.bg} ${conf.cor} px-2 py-0.5 text-[11px] font-semibold`}>
                      <Icon className="h-3 w-3" />
                      {conf.rotulo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">{c.plano}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                    {mrr > 0 ? brl(mrr) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {c.embaixador?.nomeCompleto ? `Indicação: ${c.embaixador.nomeCompleto}` : "Direto"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700">
                    {adimplenciaPct === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={
                          adimplenciaPct >= 90
                            ? "text-emerald-700 font-semibold"
                            : adimplenciaPct >= 70
                              ? "text-amber-700 font-semibold"
                              : "text-red-700 font-semibold"
                        }
                      >
                        {adimplenciaPct.toFixed(0)}%
                      </span>
                    )}
                    <span className="ml-1 text-slate-400">
                      ({pagas}/{totalCob})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.criadoEm.toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ehMinhaConta ? (
                      <span className="text-[11px] text-slate-400">você</span>
                    ) : (
                      <form action={entrarEspionagemAction} className="inline-flex">
                        <input type="hidden" name="contaId" value={c.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 transition"
                          title="Entrar no espaço deste cliente em somente leitura"
                        >
                          <Eye className="h-3 w-3" />
                          Ver como cliente
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {contas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  Nenhum cliente encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500">
        <ArrowUpRight className="h-3 w-3" /> Clique nos KPIs do painel principal para filtrar por status.
      </p>
    </div>
  );
}
