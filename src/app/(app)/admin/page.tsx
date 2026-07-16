import { Users, TrendingUp, DollarSign, AlertTriangle, UserCheck, Building2 } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { Tabs } from "@/components/Tabs";

const PRECOS = { BASICO: 397, PREMIUM: 997 };

function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default async function AdminPage() {
  const usuario = await exigirUsuario();
  // Restrito a super admin da plataforma (Regina/Igor). Tela mostra dados
  // agregados de TODAS as contas — não pode ser acessível a cliente comum.
  // Mostra tela explícita "Acesso restrito" em vez de redirect silencioso,
  // pra ficar claro caso usuário cole URL direto (regressão Regina).
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">
          Esta área é exclusiva para gestores da plataforma (Adm CP System).
        </p>
      </div>
    );
  }

  // Filtro: ignora super admins (Igor/Regina) — não são clientes pagantes
  const semSuperAdmin = { usuarios: { none: { superAdmin: true } } };

  const [contas, empresas, totalAtas, totalContratos, totalEmpenhos, analistas] = await Promise.all([
    prisma.conta.findMany({
      where: semSuperAdmin,
      include: {
        usuarios: { select: { nome: true, email: true } },
        empresas: { select: { id: true, nomeFantasia: true, razaoSocial: true, cnpj: true } },
        // Última cobrança paga (pra próxima renovação) + próxima pendente
        cobrancas: {
          select: {
            id: true, status: true, valor: true, vencimento: true, pagaEm: true, competencia: true,
            // Forma de pagamento (Igor 16/07): admin quer ver se cliente
            // pagou/paga por cartão, boleto ou PIX direto na tabela.
            forma: true,
            nfseNumero: true,
            nfsePdfUrl: true,
          },
          orderBy: { vencimento: "desc" },
          take: 6,
        },
        // Método de pagamento salvo (cartão tokenizado, etc)
        metodosPagamento: {
          where: { ativo: true, padrao: true },
          select: { forma: true, bandeira: true, ultimosDigitos: true },
          take: 1,
        },
      },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.empresa.count({ where: { conta: semSuperAdmin } }),
    prisma.ata.count({ where: { empresa: { conta: semSuperAdmin } } }),
    prisma.contrato.count({ where: { empresa: { conta: semSuperAdmin } } }),
    prisma.empenho.count({ where: { empresa: { conta: semSuperAdmin } } }),
    // Analistas com agregados financeiros (Linha B variável + fixos mensais)
    prisma.analista.findMany({
      include: {
        vinculos: {
          select: {
            id: true,
            status: true,
            conta: { select: { id: true, empresas: { select: { id: true } } } },
            // Pagamentos fixos mensais (Linha B fixa) recebidos pelo analista
            fixosPagos: {
              select: { id: true, valorRecebido: true, status: true, pagaEm: true },
            },
          },
        },
        // Comissões variáveis (Linha B) — analistaId direto
        comissoesExecucao: {
          select: { id: true, valorCalculado: true, valorRecebido: true, status: true, dataPagamento: true },
        },
      },
      orderBy: { criadoEm: "desc" },
    }),
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

  // ============================================================
  // Agregados de pagamentos a analistas (Regina: relatório individualizado + total)
  // ============================================================
  // Linha B variável: ComissaoExecucao.valorRecebido (já pago pela empresa ao analista)
  // Linha B fixa: PagamentoFixoMensal.valorRecebido (com status PAGO/PAGO_PARCIAL)
  // Pendente: comissões com status A_RECEBER (devidas mas não pagas ainda)
  type AnalistaComPagamentos = {
    id: string;
    pagoTotal: number;
    pagoVariavel: number;
    pagoFixo: number;
    aReceber: number;
    qtdPagamentos: number;
  };
  const pagamentosPorAnalista = new Map<string, AnalistaComPagamentos>();
  for (const a of analistas) {
    const pagoVariavel = a.comissoesExecucao
      .filter((c) => c.status === "PAGO" || c.status === "PAGO_PARCIAL")
      .reduce((s, c) => s + c.valorRecebido, 0);
    const aReceberVariavel = a.comissoesExecucao
      .filter((c) => c.status === "A_RECEBER" || c.status === "ATRASADO")
      .reduce((s, c) => s + c.valorCalculado, 0);
    const pagosFixosLista = a.vinculos.flatMap((v) => v.fixosPagos);
    const pagoFixo = pagosFixosLista
      .filter((p) => p.status === "PAGO" || p.status === "PAGO_PARCIAL")
      .reduce((s, p) => s + p.valorRecebido, 0);
    const aReceberFixo = pagosFixosLista
      .filter((p) => p.status === "A_RECEBER" || p.status === "ATRASADO")
      .reduce((s, p) => s + 0, 0); // fixo só conta como devido quando vence
    const qtdPagamentos =
      a.comissoesExecucao.filter((c) => c.status === "PAGO" || c.status === "PAGO_PARCIAL").length +
      pagosFixosLista.filter((p) => p.status === "PAGO" || p.status === "PAGO_PARCIAL").length;
    pagamentosPorAnalista.set(a.id, {
      id: a.id,
      pagoVariavel,
      pagoFixo,
      pagoTotal: pagoVariavel + pagoFixo,
      aReceber: aReceberVariavel + aReceberFixo,
      qtdPagamentos,
    });
  }
  const totalPagoAnalistas = Array.from(pagamentosPorAnalista.values()).reduce(
    (s, p) => s + p.pagoTotal,
    0,
  );
  const totalAReceberAnalistas = Array.from(pagamentosPorAnalista.values()).reduce(
    (s, p) => s + p.aReceber,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Admin · Painel do PO"
        titulo="Painel do"
        destaque="Proprietário"
        subtitulo={`Métricas SaaS da plataforma · Olá, ${usuario.nome}.`}
      />

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
          <Mini label="Execuções" valor={String(totalEmpenhos)} />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white">
        <Tabs
          abas={[
            {
              key: "empresas",
              label: "Empresas",
              badge: contas.length,
              content: <TabelaEmpresas contas={contas} />,
            },
            {
              key: "analistas",
              label: "Analistas",
              badge: analistas.length,
              content: (
                <TabelaAnalistas
                  analistas={analistas.map((a) => ({
                    ...a,
                    pagoTotal: pagamentosPorAnalista.get(a.id)?.pagoTotal ?? 0,
                    aReceber: pagamentosPorAnalista.get(a.id)?.aReceber ?? 0,
                    qtdPagamentos: pagamentosPorAnalista.get(a.id)?.qtdPagamentos ?? 0,
                  }))}
                  totalPago={totalPagoAnalistas}
                  totalAReceber={totalAReceberAnalistas}
                />
              ),
            },
          ]}
        />
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

// ============================================================
// ABA: EMPRESAS (assinantes/clientes do SaaS)
// ============================================================
type ContaResumo = {
  id: string;
  plano: string;
  statusAssinatura: string;
  criadoEm: Date;
  trialAteEm: Date | null;
  usuarios: { nome: string; email: string }[];
  empresas: { id: string; nomeFantasia: string | null; razaoSocial: string; cnpj: string }[];
  cobrancas: {
    id: string;
    status: string;
    valor: number;
    vencimento: Date;
    pagaEm: Date | null;
    competencia: string;
    forma: string;
    nfseNumero: string | null;
    nfsePdfUrl: string | null;
  }[];
  metodosPagamento: {
    forma: string;
    bandeira: string | null;
    ultimosDigitos: string | null;
  }[];
};

function TabelaEmpresas({ contas }: { contas: ContaResumo[] }) {
  if (contas.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-slate-500">
        <Building2 className="mx-auto h-8 w-8 opacity-40" />
        <span className="mt-2 block">Nenhuma empresa cadastrada ainda.</span>
      </p>
    );
  }
  // Pra "Vigência do plano": se TRIAL, mostra trialAteEm + dias restantes;
  // se ATIVA/INADIMPLENTE, mostra a próxima cobrança pendente (ou
  // última paga + horizonte mensal); senão CANCELADA → "—".
  function calcularVigencia(c: ContaResumo): {
    rotulo: string;
    detalhe: string;
    critico: boolean;
  } {
    const hoje = Date.now();
    if (c.statusAssinatura === "TRIAL" && c.trialAteEm) {
      const dias = Math.ceil((c.trialAteEm.getTime() - hoje) / 86400000);
      return {
        rotulo: c.trialAteEm.toLocaleDateString("pt-BR"),
        detalhe: dias > 0 ? `Trial · ${dias}d restantes` : `Trial vencido há ${-dias}d`,
        critico: dias <= 7,
      };
    }
    // Próxima cobrança pendente
    const proxima = c.cobrancas
      .filter((cb) => cb.status === "PENDENTE" || cb.status === "ATRASADA")
      .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0];
    if (proxima) {
      const dias = Math.ceil((proxima.vencimento.getTime() - hoje) / 86400000);
      return {
        rotulo: proxima.vencimento.toLocaleDateString("pt-BR"),
        detalhe:
          dias >= 0
            ? `Próxima cobrança · vence em ${dias}d`
            : `Vencida há ${-dias}d`,
        critico: dias < 0 || dias <= 7,
      };
    }
    // Última paga — projeta próximo mês como referência
    const ultima = c.cobrancas
      .filter((cb) => cb.status === "PAGA" && cb.pagaEm)
      .sort((a, b) => b.pagaEm!.getTime() - a.pagaEm!.getTime())[0];
    if (ultima && ultima.pagaEm) {
      return {
        rotulo: "Em dia",
        detalhe: `Última paga em ${ultima.pagaEm.toLocaleDateString("pt-BR")}`,
        critico: false,
      };
    }
    return { rotulo: "—", detalhe: "Sem histórico de cobrança", critico: false };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-2 text-left">Empresa</th>
            <th className="px-5 py-2 text-left">Plano</th>
            <th className="px-5 py-2 text-left">Status</th>
            <th className="px-5 py-2 text-left">Vigência do plano</th>
            <th className="px-5 py-2 text-left">Forma pgto</th>
            <th className="px-5 py-2 text-left">NF</th>
            <th className="px-5 py-2 text-right">CNPJs</th>
            <th className="px-5 py-2 text-right">Criada</th>
          </tr>
        </thead>
        <tbody>
          {contas.map((c) => {
            const empresaPrincipal = c.empresas[0];
            const nomeEmpresa =
              empresaPrincipal?.nomeFantasia ||
              empresaPrincipal?.razaoSocial ||
              "Sem empresa cadastrada";
            const usuarioResp = c.usuarios[0];
            const vig = calcularVigencia(c);
            return (
            <tr key={c.id} className="border-t border-slate-100">
              <td className="px-5 py-3">
                <div className="font-medium text-slate-900">{nomeEmpresa}</div>
                <div className="text-xs text-slate-500">
                  {empresaPrincipal?.cnpj
                    ? `CNPJ ${empresaPrincipal.cnpj}`
                    : "Sem CNPJ"}
                  {usuarioResp && (
                    <>
                      {" · "}responsável: {usuarioResp.nome}
                    </>
                  )}
                </div>
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
              <td className="px-5 py-3 text-xs">
                <div
                  className={`font-semibold ${
                    vig.critico ? "text-red-700" : "text-slate-700"
                  }`}
                >
                  {vig.rotulo}
                </div>
                <div className="text-[11px] text-slate-500">{vig.detalhe}</div>
              </td>
              <td className="px-5 py-3 text-xs">
                {(() => {
                  const met = c.metodosPagamento[0];
                  const cobRef = c.cobrancas.find((x) => x.status === "PAGA") ?? c.cobrancas[0];
                  const forma = met?.forma ?? cobRef?.forma;
                  if (!forma) return <span className="text-slate-400">—</span>;
                  const label = forma === "CARTAO_CREDITO" ? "Cartão" : forma === "PIX" ? "PIX" : "Boleto";
                  const detalhe = met?.bandeira && met?.ultimosDigitos
                    ? `${met.bandeira} · final ${met.ultimosDigitos}`
                    : cobRef?.competencia
                      ? `ref ${cobRef.competencia}`
                      : "";
                  return (
                    <div>
                      <div className="font-semibold text-slate-800">{label}</div>
                      {detalhe && <div className="text-[11px] text-slate-500">{detalhe}</div>}
                    </div>
                  );
                })()}
              </td>
              <td className="px-5 py-3 text-xs">
                {(() => {
                  const cobComNf = c.cobrancas.find((x) => x.nfseNumero);
                  if (!cobComNf) return <span className="text-slate-400">—</span>;
                  return cobComNf.nfsePdfUrl ? (
                    <a href={cobComNf.nfsePdfUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline">
                      NF {cobComNf.nfseNumero}
                    </a>
                  ) : (
                    <span className="text-slate-700">NF {cobComNf.nfseNumero}</span>
                  );
                })()}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">{c.empresas.length}</td>
              <td className="px-5 py-3 text-right text-xs text-slate-500">
                {c.criadoEm.toLocaleDateString("pt-BR")}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// ABA: ANALISTAS (de licitação, vinculados às empresas)
// ============================================================
type AnalistaResumo = {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  telefone: string;
  ativo: boolean;
  criadoEm: Date;
  vinculos: { id: string; status: string; conta: { id: string; empresas: { id: string }[] } }[];
  // Agregados financeiros computados na page (passados via prop)
  pagoTotal?: number;
  aReceber?: number;
  qtdPagamentos?: number;
};

function TabelaAnalistas({
  analistas,
  totalPago,
  totalAReceber,
}: {
  analistas: AnalistaResumo[];
  totalPago: number;
  totalAReceber: number;
}) {
  if (analistas.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-slate-500">
        <UserCheck className="mx-auto h-8 w-8 opacity-40" />
        <span className="mt-2 block">Nenhum analista cadastrado ainda.</span>
      </p>
    );
  }
  return (
    <>
      {/* Resumo financeiro do bloco — total pago + a receber */}
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total já pago aos analistas
          </p>
          <p className="mt-0.5 text-lg font-bold text-emerald-700">{brl(totalPago)}</p>
          <p className="text-[11px] text-slate-500">Linha B (variável) + fixo mensal</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            A receber (devidos)
          </p>
          <p className="mt-0.5 text-lg font-bold text-amber-700">{brl(totalAReceber)}</p>
          <p className="text-[11px] text-slate-500">Comissões em aberto + atrasadas</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2 text-left">Analista</th>
              <th className="px-5 py-2 text-left">CPF</th>
              <th className="px-5 py-2 text-left">Status</th>
              <th className="px-5 py-2 text-right">Vínculos ativos</th>
              <th className="px-5 py-2 text-right">Já pago</th>
              <th className="px-5 py-2 text-right">A receber</th>
              <th className="px-5 py-2 text-right">Cadastrado</th>
            </tr>
          </thead>
          <tbody>
            {analistas.map((a) => {
              const vinculosAtivos = a.vinculos.filter((v) => v.status === "ATIVO").length;
              const cnpjs = a.vinculos
                .filter((v) => v.status === "ATIVO")
                .reduce((s, v) => s + v.conta.empresas.length, 0);
              return (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{a.nomeCompleto}</div>
                    <div className="text-xs text-slate-500">{a.email}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-700 tabular-nums">{formatarCpf(a.cpf)}</td>
                  <td className="px-5 py-3 text-xs">
                    <span
                      className={`rounded px-2 py-0.5 font-medium ${
                        a.ativo
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {a.ativo ? "ATIVO" : "INATIVO"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {vinculosAtivos}
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({cnpjs} CNPJ{cnpjs !== 1 ? "s" : ""})
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span className="font-semibold text-emerald-700">
                      {brl(a.pagoTotal ?? 0)}
                    </span>
                    {(a.qtdPagamentos ?? 0) > 0 && (
                      <div className="text-[10px] text-slate-400">
                        em {a.qtdPagamentos} pagamento{a.qtdPagamentos !== 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {(a.aReceber ?? 0) > 0 ? (
                      <span className="font-semibold text-amber-700">{brl(a.aReceber ?? 0)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-slate-500">
                    {a.criadoEm.toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
