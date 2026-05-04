import Link from "next/link";
import {
  Building2,
  FileText,
  ClipboardList,
  Truck,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Calendar,
  MapPin,
} from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dadosPorUf } from "@/lib/agregacaoUf";
import { MapaBrasil } from "@/components/MapaBrasil";
import {
  VencimentosPorMesChart,
  TiposObjetoChart,
  StatusExecucaoChart,
  ValorAcumuladoChart,
} from "@/components/DashboardCharts";

const COR_STATUS: Record<string, string> = {
  EMPENHADO: "#94a3b8",
  PEDIDO_RECEBIDO: "#0ea5e9",
  EM_TRANSITO: "#6366f1",
  ENTREGUE: "#8b5cf6",
  NF_EMITIDA: "#f59e0b",
  NF_ENCAMINHADA: "#ea580c",
  PAGO: "#10b981",
};

const ROTULO_STATUS: Record<string, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito",
  ENTREGUE: "Entregue",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  PAGO: "Pago",
};

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function brlCompacto(n: number): string {
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(2).replace(".", ",")} Bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace(".", ",")} Mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return brl(n);
}

export default async function DashboardPage() {
  const usuario = await exigirUsuario();
  const contaId = usuario.contaId;
  const hoje = new Date();
  const fimAno = new Date(hoje.getFullYear(), 11, 31);

  const [
    qtdEmpresas,
    atasVigentes,
    contratosVigentes,
    empenhos,
    empenhosComItens,
    contratosVigentesDetalhe,
    atasVigentesDetalhe,
    proximosVencimentos,
    dadosUf,
  ] = await Promise.all([
    prisma.empresa.count({ where: { contaId } }),
    prisma.ata.count({ where: { empresa: { contaId }, vigenciaFim: { gte: hoje } } }),
    prisma.contrato.count({ where: { empresa: { contaId }, vigenciaFim: { gte: hoje } } }),
    prisma.empenho.findMany({
      where: { empresa: { contaId } },
      select: { id: true, status: true, vigenciaFim: true, dataPagamento: true, tipo: true },
    }),
    prisma.empenho.findMany({
      where: { empresa: { contaId } },
      select: { itens: { select: { valorTotal: true } }, status: true, tipo: true },
    }),
    prisma.contrato.findMany({
      where: { empresa: { contaId }, vigenciaFim: { gte: hoje } },
      select: { tipo: true, vigenciaFim: true, itens: { select: { valorTotal: true } } },
    }),
    prisma.ata.findMany({
      where: { empresa: { contaId }, vigenciaFim: { gte: hoje } },
      select: { tipo: true, vigenciaFim: true, itens: { select: { valorTotal: true } } },
    }),
    prisma.empenho.findMany({
      where: {
        empresa: { contaId },
        status: { not: "PAGO" },
        OR: [
          { dataPrevistaExecucao: { gte: hoje, lte: new Date(hoje.getTime() + 30 * 86400000) } },
          { dataPrevistaPagamento: { gte: hoje, lte: new Date(hoje.getTime() + 30 * 86400000) } },
          { vigenciaFim: { gte: hoje, lte: new Date(hoje.getTime() + 30 * 86400000) } },
        ],
      },
      select: {
        id: true,
        numero: true,
        objeto: true,
        orgaoNome: true,
        status: true,
        vigenciaFim: true,
        dataPrevistaExecucao: true,
        dataPrevistaPagamento: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
      orderBy: { vigenciaFim: "asc" },
      take: 6,
    }),
    dadosPorUf(contaId),
  ]);

  const valorEmCarteira =
    contratosVigentesDetalhe.reduce(
      (s, c) => s + c.itens.reduce((ss, i) => ss + i.valorTotal, 0),
      0,
    ) +
    atasVigentesDetalhe.reduce((s, a) => s + a.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0);

  const valorPago = empenhosComItens
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0);

  const valorPendente = empenhosComItens
    .filter((e) => e.status !== "PAGO")
    .reduce((s, e) => s + e.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0);

  // Vencimentos por mês (próximo ano corrente)
  const vencimentosPorMes = new Array(12).fill(0);
  for (const c of contratosVigentesDetalhe) {
    if (c.vigenciaFim <= fimAno && c.vigenciaFim >= hoje) {
      vencimentosPorMes[c.vigenciaFim.getMonth()] += 1;
    }
  }

  // Tipos de objeto (atas + contratos vigentes)
  const tiposMap = new Map<string, number>();
  for (const c of [...contratosVigentesDetalhe, ...atasVigentesDetalhe]) {
    tiposMap.set(c.tipo, (tiposMap.get(c.tipo) || 0) + 1);
  }
  const tiposObjeto = Array.from(tiposMap.entries())
    .map(([tipo, qtd]) => ({ tipo, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

  // Status de execução (empenhos)
  const statusMap = new Map<string, number>();
  for (const e of empenhos) statusMap.set(e.status, (statusMap.get(e.status) || 0) + 1);
  const statusExecucao = Array.from(statusMap.entries()).map(([status, qtd]) => ({
    status: ROTULO_STATUS[status] || status,
    qtd,
    cor: COR_STATUS[status] || "#94a3b8",
  }));

  const empenhosAtivos = empenhos.filter((e) => e.status !== "PAGO").length;

  const trial = usuario.conta.statusAssinatura === "TRIAL" && usuario.conta.trialAteEm;
  const diasTrial = trial
    ? Math.max(0, Math.ceil((usuario.conta.trialAteEm!.getTime() - Date.now()) / 86400000))
    : 0;

  const nomePrimeiro = usuario.nome.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Olá, {nomePrimeiro} —{" "}
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Visão consolidada das suas contratações públicas, posição financeira e logística.
          </p>
        </div>
        <Link
          href="/contratacoes/nova"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" /> Nova contratação
        </Link>
      </div>

      {trial && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span>
            Trial gratuito · <strong>{diasTrial} dias restantes</strong>. Ative uma assinatura antes do
            término para não perder acesso.
          </span>
          <Link
            href="/conta/assinatura"
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            Ver planos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* KPIs grandes (3 cards coloridos) */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <KpiHero
          titulo="Contratos vigentes em " end={hoje.getFullYear()}
          valor={(atasVigentes + contratosVigentes).toString()}
          sub={`${atasVigentes} ata(s) + ${contratosVigentes} contrato(s)`}
          gradient="from-cyan-500 to-teal-600"
          icone={ClipboardList}
        />
        <KpiHero
          titulo="Valor total em carteira"
          end={hoje.getFullYear()}
          valor={brlCompacto(valorEmCarteira)}
          sub={`vigente até dez/${hoje.getFullYear()}`}
          gradient="from-indigo-500 to-blue-700"
          icone={TrendingUp}
        />
        <KpiHero
          titulo="Valor já pago em"
          end={hoje.getFullYear()}
          valor={brlCompacto(valorPago)}
          sub={`${empenhosComItens.filter((e) => e.status === "PAGO").length} empenho(s) pagos`}
          gradient="from-emerald-500 to-green-700"
          icone={TrendingUp}
        />
      </div>

      {/* KPI secundários */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSmall titulo="Empresas (CNPJs)" valor={qtdEmpresas} icone={Building2} href="/empresas" />
        <KpiSmall titulo="Atas vigentes" valor={atasVigentes} icone={FileText} href="/atas" />
        <KpiSmall titulo="Contratos ativos" valor={contratosVigentes} icone={ClipboardList} href="/contratos" />
        <KpiSmall titulo="Empenhos em execução" valor={empenhosAtivos} icone={Truck} href="/execucao" />
      </div>

      {/* Mapa + valor acumulado */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Painel
          className="lg:col-span-2"
          titulo="Mapa de operações por estado"
          subtitulo="Distribuição geográfica das suas empresas e contratos com órgãos públicos. Passe o mouse sobre o estado para detalhes."
          icone={MapPin}
        >
          {dadosUf.length === 0 ? (
            <div className="grid h-[480px] place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <div>
                <MapPin className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">Sem dados geográficos ainda</p>
                <p className="mt-1 text-xs text-slate-500">
                  Cadastre suas empresas com endereço completo para visualizar o mapa.
                </p>
              </div>
            </div>
          ) : (
            <MapaBrasil dados={dadosUf} />
          )}
        </Painel>

        <Painel titulo="Posição financeira" subtitulo="Carteira vs executado vs pago" icone={TrendingUp}>
          <ValorAcumuladoChart pago={valorPago} pendente={valorPendente} carteira={valorEmCarteira} />
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <LinhaResumo cor="#10b981" rotulo="Já pago" valor={brl(valorPago)} />
            <LinhaResumo cor="#f59e0b" rotulo="Pendente de pagamento" valor={brl(valorPendente)} />
            <LinhaResumo cor="#0f4c81" rotulo="Em carteira (vigente)" valor={brl(valorEmCarteira)} />
          </div>
        </Painel>
      </div>

      {/* Vencimentos + tipos */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo={`Vencimento de contratos em ${hoje.getFullYear()}`}
          subtitulo="Distribuição mensal — antecipe renovações e aditivos"
          icone={Calendar}
        >
          <VencimentosPorMesChart dados={vencimentosPorMes} />
        </Painel>

        <Painel
          titulo="Tipos de objeto contratado"
          subtitulo="Composição do portfólio (atas + contratos vigentes)"
          icone={FileText}
        >
          {tiposObjeto.length === 0 ? (
            <p className="grid h-[260px] place-items-center text-sm text-slate-400">Sem dados.</p>
          ) : (
            <TiposObjetoChart dados={tiposObjeto} />
          )}
        </Painel>
      </div>

      {/* Status execução + ranking UF */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Status logístico dos empenhos"
          subtitulo="Posição atual da execução"
          icone={Truck}
        >
          {statusExecucao.length === 0 ? (
            <p className="grid h-[260px] place-items-center text-sm text-slate-400">
              Sem empenhos cadastrados ainda.
            </p>
          ) : (
            <StatusExecucaoChart dados={statusExecucao} />
          )}
        </Painel>

        <Painel
          titulo="Ranking de estados por carteira"
          subtitulo="Onde estão concentrados seus contratos públicos"
          icone={MapPin}
        >
          {dadosUf.length === 0 ? (
            <p className="grid h-[260px] place-items-center text-sm text-slate-400">Sem dados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dadosUf.slice(0, 6).map((d, i) => (
                <li key={d.uf} className="flex items-center gap-4 py-2.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-700">
                    {i + 1}
                  </span>
                  <span className="w-10 font-mono text-sm font-bold text-slate-900">{d.uf}</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                        style={{
                          width: `${Math.min(100, (d.valor / Math.max(...dadosUf.map((x) => x.valor))) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {d.empresas} empresa(s) · {d.contratos} contrato(s) · {d.empenhos} empenho(s)
                    </p>
                  </div>
                  <span className="w-28 text-right text-sm font-semibold text-slate-900">
                    {brlCompacto(d.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      {/* Próximos vencimentos */}
      <div className="mt-4">
        <Painel
          titulo="Próximos vencimentos (30 dias)"
          subtitulo="Empenhos com prazo próximo — execute ou avise o fiscal"
          icone={AlertTriangle}
        >
          {proximosVencimentos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Nenhum empenho com vencimento nos próximos 30 dias. Ótimo!
            </p>
          ) : (
            <ul className="space-y-2">
              {proximosVencimentos.map((e) => {
                const dias = Math.ceil((e.vigenciaFim.getTime() - Date.now()) / 86400000);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/execucao/${e.id}`}
                      className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-300 hover:shadow-sm"
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                          dias <= 7
                            ? "bg-red-100 text-red-700"
                            : dias <= 15
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {dias}d
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          Empenho {e.numero} · {e.objeto.slice(0, 60)}
                          {e.objeto.length > 60 ? "…" : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {e.orgaoNome} · {e.empresa.nomeFantasia || e.empresa.razaoSocial} ·{" "}
                          {ROTULO_STATUS[e.status] || e.status}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
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
  end,
  valor,
  sub,
  gradient,
  icone: Icone,
}: {
  titulo: string;
  end: string | number;
  valor: string;
  sub: string;
  gradient: string;
  icone: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg`}
    >
      <div className="relative z-10">
        <p className="text-xs font-medium uppercase tracking-wider text-white/80">
          {titulo} {end}
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight">{valor}</p>
        <p className="mt-1 text-xs text-white/80">{sub}</p>
      </div>
      <Icone className="absolute -right-2 -bottom-2 h-32 w-32 text-white/10" />
    </div>
  );
}

function KpiSmall({
  titulo,
  valor,
  icone: Icone,
  href,
}: {
  titulo: string;
  valor: number;
  icone: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
    >
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-600 transition group-hover:bg-blue-50 group-hover:text-blue-700">
        <Icone className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{valor}</p>
      </div>
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
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
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

function LinhaResumo({ cor, rotulo, valor }: { cor: string; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />
        <span className="text-sm text-slate-600">{rotulo}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900">{valor}</span>
    </div>
  );
}
