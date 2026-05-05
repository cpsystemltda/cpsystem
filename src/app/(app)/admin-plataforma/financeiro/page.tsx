import Link from "next/link";
import { Crown, Wallet, TrendingUp, Activity, Target, Users2, BarChart3 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRECO_BASICO = 397;
const PRECO_PREMIUM = 997;

// LTV simplificado: ARPU ÷ Churn mensal. Se Churn = 0, fallback de 36 meses (premium SaaS B2B típico).
function calcularLtv(arpu: number, churnMensalPct: number): number {
  if (churnMensalPct <= 0) return arpu * 36;
  return arpu / (churnMensalPct / 100);
}

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function brlCompacto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return brl(n);
}

export default async function AdminFinanceiroPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Esta área é exclusiva para gestores da plataforma.</p>
      </div>
    );
  }

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const empresas = await prisma.conta.findMany({
    where: { tipo: "EMPRESA" },
    include: {
      empresas: { select: { nomeFantasia: true, razaoSocial: true } },
      embaixador: { select: { id: true, nomeCompleto: true } },
      cobrancas: {
        select: { status: true, valor: true, vencimento: true, pagaEm: true },
        orderBy: { vencimento: "desc" },
      },
    },
  });

  const ativas = empresas.filter((c) => c.statusAssinatura === "ATIVA");
  const canceladasNoMes = empresas.filter(
    (c) =>
      c.statusAssinatura === "CANCELADA" &&
      c.atualizadoEm >= inicioMes,
  );

  const mrr = ativas.reduce(
    (s, c) => s + (c.plano === "PREMIUM" ? PRECO_PREMIUM : PRECO_BASICO),
    0,
  );
  const arr = mrr * 12;
  const arpu = ativas.length > 0 ? mrr / ativas.length : 0;
  const ticketMedioGeral =
    empresas.length > 0
      ? empresas.reduce(
          (s, c) => s + (c.plano === "PREMIUM" ? PRECO_PREMIUM : PRECO_BASICO),
          0,
        ) / empresas.length
      : 0;

  // Distribuição por plano (entre ativas)
  const ativasBasico = ativas.filter((c) => c.plano === "BASICO").length;
  const ativasPremium = ativas.filter((c) => c.plano === "PREMIUM").length;

  // Churn de cliente (mensal): canceladas no mês ÷ ativas no início do mês (aprox.)
  const denomChurn = ativas.length + canceladasNoMes.length;
  const churnPct = denomChurn > 0 ? (canceladasNoMes.length / denomChurn) * 100 : 0;

  // MRR Churn: receita perdida no mês
  const mrrChurn = canceladasNoMes.reduce(
    (s, c) => s + (c.plano === "PREMIUM" ? PRECO_PREMIUM : PRECO_BASICO),
    0,
  );

  // LTV
  const ltv = calcularLtv(arpu, churnPct);

  // Ranking de adimplência por origem (analista vs direto)
  const origens = new Map<string, { rotulo: string; total: number; pagas: number; mrr: number }>();
  for (const c of empresas) {
    const chave = c.embaixador?.id ?? "DIRETO";
    const rotulo = c.embaixador?.nomeCompleto ?? "Direto / sem indicação";
    const item = origens.get(chave) ?? { rotulo, total: 0, pagas: 0, mrr: 0 };
    for (const cb of c.cobrancas) {
      item.total += 1;
      if (cb.status === "PAGA") item.pagas += 1;
    }
    if (c.statusAssinatura === "ATIVA") {
      item.mrr += c.plano === "PREMIUM" ? PRECO_PREMIUM : PRECO_BASICO;
    }
    origens.set(chave, item);
  }
  const ranking = Array.from(origens.values())
    .filter((o) => o.total > 0)
    .map((o) => ({ ...o, adimplenciaPct: (o.pagas / o.total) * 100 }))
    .sort((a, b) => b.adimplenciaPct - a.adimplenciaPct);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Financeiro
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Dashboard de BI Financeiro
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Indicadores críticos do SaaS — alimentados pelo gateway de pagamento em tempo real.
          </p>
        </div>
        <Link href="/admin-plataforma" className="text-sm text-slate-600 hover:text-slate-900">
          ← Voltar à visão geral
        </Link>
      </div>

      {/* KPIs principais */}
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Card icone={Wallet} cor="from-emerald-500 to-green-700" titulo="MRR" valor={brlCompacto(mrr)} sub={`${ativas.length} assinaturas ativas`} />
        <Card icone={TrendingUp} cor="from-blue-500 to-indigo-700" titulo="ARR projetado" valor={brlCompacto(arr)} sub="MRR × 12" />
        <Card icone={Target} cor="from-amber-500 to-orange-700" titulo="Ticket médio" valor={brl(ticketMedioGeral)} sub="ARPU geral (todas as contas)" />
        <Card icone={Users2} cor="from-violet-500 to-fuchsia-700" titulo="LTV" valor={brl(ltv)} sub={churnPct > 0 ? `${arpu.toFixed(0)} ÷ ${churnPct.toFixed(2)}% churn mensal` : "Churn ≈ 0 — projeção 36 meses"} />
      </div>

      {/* Churn rate + MRR Churn */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card icone={Activity} cor="from-red-500 to-rose-700" titulo="Churn rate (mês)" valor={`${churnPct.toFixed(2)}%`} sub={`${canceladasNoMes.length} cancelamento(s) em ${hoje.toLocaleDateString("pt-BR", { month: "long" })}`} />
        <Card icone={BarChart3} cor="from-slate-700 to-slate-900" titulo="MRR Churn" valor={brl(mrrChurn)} sub="Receita recorrente perdida no mês" />
      </div>

      {/* Distribuição por plano */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Distribuição por plano
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <PlanoCard
            titulo="Básico"
            preco={PRECO_BASICO}
            ativos={ativasBasico}
            total={ativas.length}
            cor="bg-slate-100 text-slate-700"
          />
          <PlanoCard
            titulo="Premium"
            preco={PRECO_PREMIUM}
            ativos={ativasPremium}
            total={ativas.length}
            cor="bg-violet-100 text-violet-700"
          />
        </div>
      </div>

      {/* Ranking de adimplência por origem */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Ranking de adimplência por origem
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Compara a qualidade financeira dos clientes por canal de aquisição (analistas vs aquisição direta).
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Origem</th>
                <th className="px-4 py-3 text-right font-medium">Cobranças</th>
                <th className="px-4 py-3 text-right font-medium">Pagas</th>
                <th className="px-4 py-3 text-right font-medium">Adimplência</th>
                <th className="px-4 py-3 text-right font-medium">MRR ativo</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    Sem cobranças registradas ainda. Quando as primeiras assinaturas pagas
                    rodarem, o ranking aparece aqui.
                  </td>
                </tr>
              ) : (
                ranking.map((o, i) => (
                  <tr key={o.rotulo} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold text-slate-700">{i + 1}º</td>
                    <td className="px-4 py-3 text-slate-900">{o.rotulo}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{o.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{o.pagas}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          o.adimplenciaPct >= 90
                            ? "text-emerald-700 font-bold"
                            : o.adimplenciaPct >= 70
                              ? "text-amber-700 font-bold"
                              : "text-red-700 font-bold"
                        }
                      >
                        {o.adimplenciaPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{brl(o.mrr)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ icone: Icone, cor, titulo, valor, sub }: { icone: React.ComponentType<{ className?: string }>; cor: string; titulo: string; valor: string; sub?: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cor} p-5 text-white shadow-lg`}>
      <Icone className="h-5 w-5 text-white/70" />
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/80">{titulo}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight">{valor}</p>
      {sub && <p className="mt-2 text-xs text-white/80">{sub}</p>}
    </div>
  );
}

function PlanoCard({ titulo, preco, ativos, total, cor }: { titulo: string; preco: number; ativos: number; total: number; cor: string }) {
  const pct = total > 0 ? (ativos / total) * 100 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}>{titulo}</span>
        <span className="text-xs text-slate-500">{brl(preco)}/mês</span>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{ativos}</p>
      <p className="text-xs text-slate-500">assinaturas ativas neste plano</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-violet-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{pct.toFixed(0)}% das assinaturas ativas</p>
    </div>
  );
}
