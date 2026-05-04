import { Settings, Users, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";

const PRECOS = { BASICO: 397, PREMIUM: 997 };

export default async function AdminPage() {
  const usuario = await exigirUsuario();
  // Em produção: gate por role/perfil. Aqui no MVP, qualquer usuário acessa pra demonstração.

  const [contas, empresas, totalAtas, totalContratos, totalEmpenhos] = await Promise.all([
    prisma.conta.findMany({
      include: {
        usuarios: { select: { nome: true, email: true } },
        empresas: { select: { id: true } },
      },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.empresa.count(),
    prisma.ata.count(),
    prisma.contrato.count(),
    prisma.empenho.count(),
  ]);

  const ativas = contas.filter((c) => c.statusAssinatura === "ATIVA");
  const trial = contas.filter((c) => c.statusAssinatura === "TRIAL");
  const inadimplentes = contas.filter((c) => c.statusAssinatura === "INADIMPLENTE");
  const canceladas = contas.filter((c) => c.statusAssinatura === "CANCELADA");

  const mrr = ativas.reduce((s, c) => s + PRECOS[c.plano as keyof typeof PRECOS], 0);
  const arrProjetado = mrr * 12;

  const ticketMedio = ativas.length > 0 ? mrr / ativas.length : 0;
  const churnPct = contas.length > 0 ? (canceladas.length / contas.length) * 100 : 0;
  const conversaoTrial = contas.length > 0 ? (ativas.length / (ativas.length + trial.length || 1)) * 100 : 0;

  const distribuicaoPlano = {
    BASICO: ativas.filter((c) => c.plano === "BASICO").length,
    PREMIUM: ativas.filter((c) => c.plano === "PREMIUM").length,
  };

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin do Proprietário</h1>
          <p className="mt-1 text-sm text-slate-600">
            Métricas SaaS da plataforma · Olá, {usuario.nome}.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card icone={DollarSign} titulo="MRR" valor={brl(mrr)} sub="Receita recorrente mensal" cor="emerald" />
        <Card icone={TrendingUp} titulo="ARR projetado" valor={brl(arrProjetado)} sub="MRR × 12" cor="blue" />
        <Card icone={Users} titulo="Assinantes ativos" valor={String(ativas.length)} sub={`${trial.length} em trial`} cor="violet" />
        <Card icone={DollarSign} titulo="Ticket médio" valor={brl(ticketMedio)} sub="por conta ativa" cor="amber" />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Distribuição de planos</h2>
          <div className="mt-4 space-y-3">
            <Barra label="Básico (R$ 397/mês)" qtd={distribuicaoPlano.BASICO} total={ativas.length} cor="bg-blue-500" />
            <Barra label="Premium (R$ 997/mês)" qtd={distribuicaoPlano.PREMIUM} total={ativas.length} cor="bg-violet-500" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Status das contas</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Pill label="Trial" qtd={trial.length} cor="amber" />
            <Pill label="Ativas" qtd={ativas.length} cor="emerald" />
            <Pill label="Inadimplentes" qtd={inadimplentes.length} cor="red" />
            <Pill label="Canceladas" qtd={canceladas.length} cor="slate" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
            <Mini label="Churn estimado" valor={`${churnPct.toFixed(1)}%`} />
            <Mini label="Conversão trial → ativa" valor={`${conversaoTrial.toFixed(1)}%`} />
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Volume agregado da plataforma</h2>
        <div className="mt-4 grid grid-cols-4 gap-4 text-center">
          <Mini label="Empresas (CNPJs)" valor={String(empresas)} />
          <Mini label="Atas" valor={String(totalAtas)} />
          <Mini label="Contratos" valor={String(totalContratos)} />
          <Mini label="Empenhos" valor={String(totalEmpenhos)} />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Contas cadastradas ({contas.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-2 text-left">Usuário principal</th>
                <th className="px-5 py-2 text-left">Plano</th>
                <th className="px-5 py-2 text-left">Status</th>
                <th className="px-5 py-2 text-right">CNPJs</th>
                <th className="px-5 py-2 text-right">Criada</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{c.usuarios[0]?.nome || "—"}</div>
                    <div className="text-xs text-slate-500">{c.usuarios[0]?.email || "—"}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        c.plano === "PREMIUM" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {c.plano}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span
                      className={`rounded px-2 py-0.5 font-medium ${
                        c.statusAssinatura === "ATIVA"
                          ? "bg-emerald-100 text-emerald-700"
                          : c.statusAssinatura === "TRIAL"
                            ? "bg-amber-100 text-amber-700"
                            : c.statusAssinatura === "INADIMPLENTE"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {c.statusAssinatura}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">{c.empresas.length}</td>
                  <td className="px-5 py-3 text-right text-xs text-slate-500">
                    {c.criadoEm.toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {inadimplentes.length > 0 && (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-900">
            <AlertTriangle className="h-4 w-4" /> {inadimplentes.length} conta(s) inadimplente(s)
          </h2>
          <p className="mt-2 text-xs text-red-700">
            Bloqueio automático será integrado quando o gateway de pagamento estiver ativo.
          </p>
        </section>
      )}
    </div>
  );
}

function Card({
  icone: Icone,
  titulo,
  valor,
  sub,
  cor,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  valor: string;
  sub: string;
  cor: "emerald" | "blue" | "violet" | "amber";
}) {
  const cores = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    amber: "bg-amber-50 text-amber-700",
  }[cor];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
        <div className={`grid h-7 w-7 place-items-center rounded ${cores}`}>
          <Icone className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Barra({ label, qtd, total, cor }: { label: string; qtd: number; total: number; cor: string }) {
  const pct = total > 0 ? (qtd / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-600">{qtd} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Pill({ label, qtd, cor }: { label: string; qtd: number; cor: "emerald" | "amber" | "red" | "slate" }) {
  const cores = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  }[cor];

  return (
    <div className={`rounded-md px-3 py-2 ${cores}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{qtd}</div>
    </div>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{valor}</p>
    </div>
  );
}
