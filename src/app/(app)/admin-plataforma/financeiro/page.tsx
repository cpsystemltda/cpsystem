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
    where: {
      tipo: "EMPRESA",
      // Ignora super admins (Igor/Regina) — não são clientes pagantes
      usuarios: { none: { superAdmin: true } },
    },
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
      <header className="glass mb-6 flex items-end justify-between gap-6 rounded-[24px] px-7 py-5">
        <div className="relative z-[1]">
          <p
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary-deep)" }}
          >
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Financeiro
          </p>
          <h1
            className="mt-2 text-[32px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
          >
            Dashboard de BI{" "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-deep), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Financeiro
            </em>
          </h1>
          <p className="mt-2 max-w-[640px] text-[14px]" style={{ color: "var(--text-soft)" }}>
            Indicadores críticos do SaaS — alimentados pelo gateway de pagamento em tempo real.
          </p>
        </div>
        <Link
          href="/admin-plataforma"
          className="text-sm font-semibold transition hover:opacity-70"
          style={{ color: "var(--text-soft)" }}
        >
          ← Voltar à visão geral
        </Link>
      </header>

      {/* KPIs principais */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card icone={Wallet} tone="mint" titulo="MRR" valor={brlCompacto(mrr)} sub={`${ativas.length} assinaturas ativas`} />
        <Card icone={TrendingUp} tone="sky" titulo="ARR projetado" valor={brlCompacto(arr)} sub="MRR × 12" />
        <Card icone={Target} tone="primary" titulo="Ticket médio" valor={brl(ticketMedioGeral)} sub="ARPU geral (todas as contas)" />
        <Card icone={Users2} tone="lavender" titulo="LTV" valor={brl(ltv)} sub={churnPct > 0 ? `${arpu.toFixed(0)} ÷ ${churnPct.toFixed(2)}% churn mensal` : "Churn ≈ 0 — projeção 36 meses"} />
      </div>

      {/* Churn rate + MRR Churn */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card icone={Activity} tone="coral" titulo="Churn rate (mês)" valor={`${churnPct.toFixed(2)}%`} sub={`${canceladasNoMes.length} cancelamento(s) em ${hoje.toLocaleDateString("pt-BR", { month: "long" })}`} />
        <Card icone={BarChart3} tone="rose" titulo="MRR Churn" valor={brl(mrrChurn)} sub="Receita recorrente perdida no mês" />
      </div>

      {/* Distribuição por plano */}
      <div className="mt-8">
        <h2
          className="text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Distribuição por plano
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <PlanoCard tone="sky" titulo="Básico" preco={PRECO_BASICO} ativos={ativasBasico} total={ativas.length} />
          <PlanoCard tone="lavender" titulo="Premium" preco={PRECO_PREMIUM} ativos={ativasPremium} total={ativas.length} />
        </div>
      </div>

      {/* Ranking de adimplência por origem */}
      <div className="mt-8">
        <h2
          className="text-[12px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
        >
          Ranking de adimplência por origem
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
          Compara a qualidade financeira dos clientes por canal de aquisição (analistas vs aquisição direta).
        </p>
        <div className="glass mt-3 overflow-hidden rounded-[20px]">
          <table className="table-glass">
            <thead>
              <tr>
                <th>#</th>
                <th>Origem</th>
                <th className="num">Cobranças</th>
                <th className="num">Pagas</th>
                <th className="num">Adimplência</th>
                <th className="num">MRR ativo</th>
              </tr>
            </thead>
            <tbody>
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={6} className="center" style={{ padding: "48px 24px", color: "var(--text-mute)" }}>
                    Sem cobranças registradas ainda. Quando as primeiras assinaturas pagas
                    rodarem, o ranking aparece aqui.
                  </td>
                </tr>
              ) : (
                ranking.map((o, i) => (
                  <tr key={o.rotulo}>
                    <td className="strong">{i + 1}º</td>
                    <td className="strong">{o.rotulo}</td>
                    <td className="num">{o.total}</td>
                    <td className="num" style={{ color: "var(--mint-deep)", fontWeight: 700 }}>{o.pagas}</td>
                    <td className="num">
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            o.adimplenciaPct >= 90
                              ? "var(--mint-deep)"
                              : o.adimplenciaPct >= 70
                                ? "var(--primary-deep)"
                                : "var(--coral-deep)",
                        }}
                      >
                        {o.adimplenciaPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="num">{brl(o.mrr)}</td>
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

type Tone = "primary" | "mint" | "rose" | "lavender" | "sky" | "coral";

const ICON_BG: Record<Tone, string> = {
  primary:  "rgba(212, 175, 55, 0.20)",
  mint:     "rgba(93, 216, 182, 0.20)",
  rose:     "rgba(240, 184, 168, 0.20)",
  lavender: "rgba(197, 180, 255, 0.20)",
  sky:      "rgba(184, 197, 214, 0.22)",
  coral:    "rgba(232, 138, 152, 0.20)",
};

const ICON_COLOR: Record<Tone, string> = {
  primary:  "var(--primary-deep)",
  mint:     "var(--mint-deep)",
  rose:     "#C68E7B",
  lavender: "#8E73E0",
  sky:      "#6F8BAA",
  coral:    "var(--coral-deep)",
};

function Card({ icone: Icone, tone, titulo, valor, sub }: { icone: React.ComponentType<{ className?: string }>; tone: Tone; titulo: string; valor: string; sub?: string }) {
  return (
    <div className={`glass-tile relative overflow-hidden t-${tone} rounded-[18px] px-5 py-5`}>
      <div className="kpi-aura" />
      <div className="relative z-[1]">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
            style={{ background: ICON_BG[tone], color: ICON_COLOR[tone] }}
          >
            <Icone className="h-5 w-5" />
          </div>
          <h3
            className="flex-1 text-[15px] font-extrabold leading-tight"
            style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
          >
            {titulo}
          </h3>
        </div>
        <p
          className="mt-3 text-[34px] font-extrabold tabular leading-none"
          style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
        >
          {valor}
        </p>
        {sub && (
          <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--text-soft)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function PlanoCard({ tone, titulo, preco, ativos, total }: { tone: Tone; titulo: string; preco: number; ativos: number; total: number }) {
  const pct = total > 0 ? (ativos / total) * 100 : 0;
  return (
    <div className={`glass-tile relative overflow-hidden t-${tone} rounded-[18px] px-5 py-5`}>
      <div className="kpi-aura" />
      <div className="relative z-[1]">
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase"
            style={{
              letterSpacing: "0.14em",
              background: ICON_BG[tone],
              color: ICON_COLOR[tone],
              border: `0.5px solid ${ICON_COLOR[tone]}40`,
            }}
          >
            {titulo}
          </span>
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-soft)" }}>
            {brl(preco)}/mês
          </span>
        </div>
        <p
          className="mt-4 text-[34px] font-extrabold tabular leading-none"
          style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
        >
          {ativos}
        </p>
        <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--text-soft)" }}>
          assinaturas ativas neste plano
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: "rgba(15,14,12,0.06)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${ICON_COLOR[tone]}, ${ICON_COLOR[tone]}cc)`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] font-semibold" style={{ color: "var(--text-soft)" }}>
          {pct.toFixed(0)}% das assinaturas ativas
        </p>
      </div>
    </div>
  );
}
