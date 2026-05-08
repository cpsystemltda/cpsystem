import Link from "next/link";
import {
  Crown,
  Users2,
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Building2,
  UserCheck,
  Activity,
} from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/SecaoGlass";

const PRECO_BASICO = 397;
const PRECO_PREMIUM = 997;

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function brlCompacto(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return brl(n);
}

const STATUS_CONFIG: Record<string, { rotulo: string; cor: string; bg: string; icone: React.ComponentType<{ className?: string }> }> = {
  TRIAL: { rotulo: "Trial", cor: "text-violet-700", bg: "bg-violet-100", icone: Clock },
  ATIVA: { rotulo: "Em dia", cor: "text-emerald-700", bg: "bg-emerald-100", icone: CheckCircle2 },
  INADIMPLENTE: { rotulo: "Inadimplente", cor: "text-red-700", bg: "bg-red-100", icone: AlertTriangle },
  CANCELADA: { rotulo: "Cancelada", cor: "text-slate-600", bg: "bg-slate-100", icone: XCircle },
};

export default async function AdminPlataformaPage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">
          Esta área é exclusiva para gestores da plataforma. Contate o administrador.
        </p>
      </div>
    );
  }

  const hoje = new Date();
  const em7dias = new Date(hoje.getTime() + 7 * 86400000);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

  const [contas, contasUltimoMes, atividadeRecente] = await Promise.all([
    prisma.conta.findMany({
      include: {
        empresas: { select: { razaoSocial: true, nomeFantasia: true } },
        analista: { select: { nomeCompleto: true } },
        usuarios: { select: { id: true, nome: true, email: true, criadoEm: true } },
        cobrancas: {
          select: { id: true, status: true, vencimento: true, valor: true },
          orderBy: { vencimento: "desc" },
          take: 3,
        },
      },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.conta.count({
      where: {
        criadoEm: { gte: inicioMesPassado, lt: inicioMes },
        tipo: "EMPRESA",
      },
    }),
    prisma.logAuditoria.findMany({
      take: 8,
      orderBy: { criadoEm: "desc" },
      include: {
        conta: { select: { empresas: { select: { nomeFantasia: true, razaoSocial: true } } } },
        usuario: { select: { nome: true } },
      },
    }),
  ]);

  const empresas = contas.filter((c) => c.tipo === "EMPRESA");
  const analistas = contas.filter((c) => c.tipo === "ANALISTA");

  const ativasEmpresa = empresas.filter((c) => c.statusAssinatura === "ATIVA");
  const inadimplentes = empresas.filter((c) => c.statusAssinatura === "INADIMPLENTE");
  const trial = empresas.filter((c) => c.statusAssinatura === "TRIAL");
  const canceladas = empresas.filter((c) => c.statusAssinatura === "CANCELADA");

  const trialProximoVencimento = trial.filter(
    (c) => c.trialAteEm && c.trialAteEm >= hoje && c.trialAteEm <= em7dias,
  );

  const mrr = ativasEmpresa.reduce(
    (s, c) => s + (c.plano === "PREMIUM" ? PRECO_PREMIUM : PRECO_BASICO),
    0,
  );
  const arr = mrr * 12;

  const novasEsteMes = empresas.filter((c) => c.criadoEm >= inicioMes).length;
  const churnRate =
    empresas.length > 0 ? (canceladas.length / Math.max(1, empresas.length)) * 100 : 0;

  // Crescimento simples MoM
  const novasMesPassado = contasUltimoMes;
  const crescimentoPct =
    novasMesPassado > 0 ? ((novasEsteMes - novasMesPassado) / novasMesPassado) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      {/* Header */}
      <PageHeader
        eyebrow="Gestor da plataforma"
        titulo="Visão geral"
        destaque="CP System"
        subtitulo="Quem usa, quem paga, quem está prestes a vencer e o que precisa da sua atenção agora."
        cta={
          <Link href="/admin-plataforma/clientes" className="btn-primary">
            Ver clientes
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      {/* KPIs hero */}
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <KpiHero
          titulo="MRR atual"
          valor={brlCompacto(mrr)}
          sub={`${ativasEmpresa.length} assinaturas ativas`}
          gradient="from-emerald-500 to-green-700"
          icone={Wallet}
        />
        <KpiHero
          titulo="ARR projetado"
          valor={brlCompacto(arr)}
          sub="MRR × 12"
          gradient="from-blue-500 to-indigo-700"
          icone={TrendingUp}
        />
        <KpiHero
          titulo="Clientes totais"
          valor={empresas.length.toString()}
          sub={`${novasEsteMes} novos este mês ${
            crescimentoPct !== 0 ? `(${crescimentoPct > 0 ? "+" : ""}${crescimentoPct.toFixed(0)}% vs mês passado)` : ""
          }`}
          gradient="from-violet-500 to-fuchsia-700"
          icone={Users2}
        />
        <KpiHero
          titulo="Churn rate"
          valor={`${churnRate.toFixed(1)}%`}
          sub={`${canceladas.length} cancelamento(s)`}
          gradient={churnRate > 5 ? "from-red-500 to-rose-700" : "from-slate-700 to-slate-900"}
          icone={Activity}
        />
      </div>

      {/* Status breakdown */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          titulo="Em dia"
          qtd={ativasEmpresa.length}
          cor="emerald"
          icone={CheckCircle2}
          link="/admin-plataforma/clientes?status=ATIVA"
        />
        <StatusCard
          titulo="Em trial"
          qtd={trial.length}
          alerta={trialProximoVencimento.length}
          alertaTexto={`${trialProximoVencimento.length} vencem em ≤7 dias`}
          cor="violet"
          icone={Clock}
          link="/admin-plataforma/clientes?status=TRIAL"
        />
        <StatusCard
          titulo="Inadimplentes"
          qtd={inadimplentes.length}
          cor="red"
          icone={AlertTriangle}
          link="/admin-plataforma/clientes?status=INADIMPLENTE"
        />
        <StatusCard
          titulo="Canceladas"
          qtd={canceladas.length}
          cor="slate"
          icone={XCircle}
          link="/admin-plataforma/clientes?status=CANCELADA"
        />
      </div>

      {/* Tabela de clientes que precisam de atenção + atividade */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Precisa da sua atenção agora"
          subtitulo="Trials que vencem em até 7 dias e contas inadimplentes"
          icone={AlertTriangle}
        >
          {trialProximoVencimento.length === 0 && inadimplentes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Tudo em ordem. Nenhum cliente em risco no momento. 🎯
            </p>
          ) : (
            <div className="space-y-2">
              {[...inadimplentes, ...trialProximoVencimento].map((c) => {
                const nome =
                  c.empresas[0]?.nomeFantasia ||
                  c.empresas[0]?.razaoSocial ||
                  c.analista?.nomeCompleto ||
                  "—";
                const conf = STATUS_CONFIG[c.statusAssinatura];
                const Icone = conf?.icone || AlertTriangle;
                const diasParaTrial = c.trialAteEm
                  ? Math.ceil((c.trialAteEm.getTime() - hoje.getTime()) / 86400000)
                  : null;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${conf?.bg} ${conf?.cor}`}
                    >
                      <Icone className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{nome}</p>
                      <p className="text-xs text-slate-500">
                        {conf?.rotulo} ·{" "}
                        {c.statusAssinatura === "TRIAL" && diasParaTrial !== null
                          ? `Trial vence em ${diasParaTrial}d`
                          : c.statusAssinatura === "INADIMPLENTE"
                          ? `${c.cobrancas.filter((cb) => cb.status === "ATRASADA").length} fatura(s) atrasada(s)`
                          : "—"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${conf?.bg} ${conf?.cor}`}
                    >
                      {c.plano}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Painel>

        <Painel titulo="Composição da base" icone={Users2}>
          <div className="space-y-4">
            <Composicao
              icone={Building2}
              cor="bg-blue-100 text-blue-700"
              titulo="Empresas fornecedoras"
              valor={empresas.length}
              sub={`${ativasEmpresa.length} pagantes · ${trial.length} em trial`}
            />
            <Composicao
              icone={UserCheck}
              cor="bg-emerald-100 text-emerald-700"
              titulo="Analistas cadastrados"
              valor={analistas.length}
              sub="Painel próprio gratuito"
            />
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Distribuição por plano
              </p>
              <div className="mt-3 space-y-2.5">
                <PlanoBar
                  label="Premium · R$ 997"
                  qtd={ativasEmpresa.filter((c) => c.plano === "PREMIUM").length}
                  total={Math.max(1, ativasEmpresa.length)}
                  cor="bg-violet-600"
                />
                <PlanoBar
                  label="Básico · R$ 397"
                  qtd={ativasEmpresa.filter((c) => c.plano === "BASICO").length}
                  total={Math.max(1, ativasEmpresa.length)}
                  cor="bg-blue-600"
                />
              </div>
            </div>
          </div>
        </Painel>
      </div>

      {/* Últimos clientes + atividade */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel titulo="Últimas contas criadas" icone={Users2}>
          {contas.slice(0, 6).length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nenhuma conta cadastrada.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contas.slice(0, 6).map((c) => {
                const nome =
                  c.empresas[0]?.nomeFantasia ||
                  c.empresas[0]?.razaoSocial ||
                  c.analista?.nomeCompleto ||
                  "—";
                const conf = STATUS_CONFIG[c.statusAssinatura];
                return (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">
                      {nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{nome}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.tipo === "EMPRESA" ? "Empresa" : "Analista"} · criado em{" "}
                        {c.criadoEm.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {conf && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${conf.bg} ${conf.cor}`}
                      >
                        {conf.rotulo}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <Painel titulo="Atividade recente" icone={Activity} subtitulo="Últimos eventos auditados">
          {atividadeRecente.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Sem atividade recente.</p>
          ) : (
            <ul className="space-y-2">
              {atividadeRecente.map((a) => {
                const empresaNome =
                  a.conta?.empresas[0]?.nomeFantasia || a.conta?.empresas[0]?.razaoSocial || "—";
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="text-slate-900">
                        <strong>{a.usuario?.nome || "Sistema"}</strong> · {a.acao.toLowerCase()}{" "}
                        <span className="font-mono text-slate-600">{a.recurso}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {empresaNome} · {a.criadoEm.toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>
    </div>
  );
}

function KpiHero({
  titulo,
  valor,
  sub,
  gradient,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  sub: string;
  gradient: string;
  icone: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{titulo}</p>
      <p className="mt-1.5 text-3xl font-bold tracking-tight">{valor}</p>
      <p className="mt-1 text-[11px] text-white/80">{sub}</p>
      <Icone className="absolute -right-2 -bottom-2 h-24 w-24 text-white/10" />
    </div>
  );
}

function StatusCard({
  titulo,
  qtd,
  cor,
  icone: Icone,
  link,
  alerta,
  alertaTexto,
}: {
  titulo: string;
  qtd: number;
  cor: "emerald" | "red" | "violet" | "slate";
  icone: React.ComponentType<{ className?: string }>;
  link: string;
  alerta?: number;
  alertaTexto?: string;
}) {
  const map = {
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    violet: "bg-violet-100 text-violet-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Link
      href={link}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${map[cor]}`}>
        <Icone className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{qtd}</p>
        {alerta && alerta > 0 && alertaTexto && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-700">{alertaTexto}</p>
        )}
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-700" />
    </Link>
  );
}

function Painel({
  titulo,
  subtitulo,
  icone: Icone,
  children,
  className = "",
}: {
  titulo: string;
  subtitulo?: string;
  icone?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        {Icone && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600">
            <Icone className="h-4 w-4" />
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Composicao({
  icone: Icone,
  cor,
  titulo,
  valor,
  sub,
}: {
  icone: React.ComponentType<{ className?: string }>;
  cor: string;
  titulo: string;
  valor: number;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${cor}`}>
        <Icone className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-slate-500">{titulo}</p>
        <p className="text-xl font-bold text-slate-900">{valor}</p>
        <p className="text-[11px] text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function PlanoBar({ label, qtd, total, cor }: { label: string; qtd: number; total: number; cor: string }) {
  const pct = (qtd / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900">
          {qtd} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
