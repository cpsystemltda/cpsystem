import Link from "next/link";
import { Crown, Search, ArrowUpRight, AlertTriangle, CheckCircle2, Clock, XCircle, Eye, ShieldCheck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BotaoArquivo } from "./BotaoArquivo";
import { faixasDasContas } from "@/lib/faixasTerceirizacaoServer";
import { asaasDisponivel, pagamentosAsaas, resumoPorConta, type ResumoCobrancaConta } from "@/lib/asaasFinanceiro";
import { contaEhPagante, mensalidadeDaConta } from "@/lib/metricasReceita";
import { entrarEspionagemAction } from "@/lib/espionagem";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import { normalizarCnpj } from "@/lib/cnpj";

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
  searchParams: Promise<{ status?: string; q?: string; tipo?: string; arquivadas?: string; terceirizacao?: string }>;
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

  const verArquivadas = sp?.arquivadas === "1";

  const [totalCarteira, totalArquivadas] = await Promise.all([
    prisma.conta.count({ where: { arquivadaEm: null } }),
    prisma.conta.count({ where: { arquivadaEm: { not: null } } }),
  ]);

  const contasTodas = await prisma.conta.findMany({
    where: {
      // Mostra todas as contas — inclusive as de super admin (Regina/Igor),
      // pra permitir entrar via modo espionagem se necessário. Linhas com
      // super admin recebem badge "Adm CP" pra distinguir.
      //
      // Arquivada NÃO aparece. Regina 24/09: *"eu não posso ficar com esse
      // lixo ali dentro do sistema"*. A carteira tem que mostrar gente de
      // verdade — quem parou de existir como cliente some da vista, mas
      // continua no banco por 30 dias, caso volte. `?arquivadas=1` traz de
      // volta quando for preciso conferir.
      ...(verArquivadas ? { arquivadaEm: { not: null } } : { arquivadaEm: null }),
      ...(statusFiltro && { statusAssinatura: statusFiltro as "TRIAL" | "ATIVA" | "INADIMPLENTE" | "CANCELADA" }),
      ...(tipo === "EMPRESA" && { tipo: "EMPRESA" }),
      ...(tipo === "ANALISTA" && { tipo: "ANALISTA" }),
      ...(q && {
        OR: [
          { empresas: { some: { OR: [
            { razaoSocial: { contains: q, mode: "insensitive" } },
            { nomeFantasia: { contains: q, mode: "insensitive" } },
            // Só entra quando a busca tem cara de CNPJ: `contains: ""` casava
            // com toda empresa e a busca por nome devolvia a lista inteira.
            ...(normalizarCnpj(q) ? [{ cnpj: { contains: normalizarCnpj(q) } }] : []),
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

  // ESP-011 RN08: colaboradores ativos (pico do mês) e faixa; filtro "usa Módulo Terceirização".
  const faixasConta = await faixasDasContas(contasTodas.map((c) => c.id));
  const soTerceirizacao = sp.terceirizacao === "1";
  const contas = soTerceirizacao ? contasTodas.filter((c) => faixasConta.get(c.id)?.usaModulo) : contasTodas;

  // Regina 09/11/2026: "ao lado de cada cliente, quando é feita a cobrança
  // e qual a data do próximo pagamento — temos que ter clareza". Lido do
  // Asaas; se a assinatura ainda não gerou a próxima cobrança, vale o
  // nextDueDate da assinatura; sem Asaas, o vencimento gravado na conta.
  const asaas = await pagamentosAsaas("2026-01-01");
  const resumoCob: Map<string, ResumoCobrancaConta> = asaas.ok ? resumoPorConta(asaas.dados) : new Map();
  const proxDaAssinatura = new Map<string, { vencimento: string; valor: number | null }>();
  const gw = await asaasDisponivel();
  if (gw) {
    await Promise.all(
      contas
        .filter((c) => c.gatewaySubscriptionId && !resumoCob.get(c.id)?.proxima)
        .map(async (c) => {
          const sub = await gw.consultarAssinatura(c.gatewaySubscriptionId as string).catch(() => null);
          if (sub?.proximoVencimento && sub.status === "ACTIVE") proxDaAssinatura.set(c.id, { vencimento: sub.proximoVencimento.toISOString().slice(0, 10), valor: null });
        }),
    );
  }
  const dBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
  const FORMA: Record<string, string> = { PIX: "PIX", CREDIT_CARD: "cartão", BOLETO: "boleto", UNDEFINED: "" };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Clientes
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            {verArquivadas ? "Clientes arquivados" : "Carteira de clientes"}
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

      {/* Carteira × Arquivados (Regina 11/11/2026) */}
      <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
        <Link href="/admin-plataforma/clientes" className={`rounded-lg px-4 py-1.5 font-semibold transition ${!verArquivadas ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
          Carteira ({totalCarteira})
        </Link>
        <Link href="/admin-plataforma/clientes?arquivadas=1" className={`rounded-lg px-4 py-1.5 font-semibold transition ${verArquivadas ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
          Arquivados ({totalArquivadas})
        </Link>
      </div>

      {/* Filtros */}
      <form method="get" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {verArquivadas && <input type="hidden" name="arquivadas" value="1" />}
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
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="terceirizacao" value="1" defaultChecked={soTerceirizacao} /> Usa Módulo Terceirização
        </label>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      {/* Tabela — overflow-x-auto pra tabela larga (9 colunas) nao esconder o botao
          "Ver como cliente" da ultima coluna (Regina 25/07: cliente cortado).
          Regina 28/08: "cade o modo espionagem?" — o overflow resolveu o layout
          mas nao o achado: com 1100px de largura minima, a coluna de Acoes fica
          fora da tela num notebook e so aparece rolando pro lado. Agora ela e
          sticky na direita, entao o botao fica visivel sem rolagem nenhuma. */}
      {asaas.ok ? (
        <p className="mt-4 text-xs text-slate-500">Cobranças e próximos pagamentos lidos do Asaas em {asaas.lidoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
      ) : (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">Asaas não respondeu ({asaas.erro}). Próximo pagamento mostrado pelo registro interno.</p>
      )}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold">Situação</th>
              <th className="px-4 py-3 text-left font-semibold">Plano · MRR</th>
              <th className="px-4 py-3 text-left font-semibold">Cobrança</th>
              <th className="px-4 py-3 text-left font-semibold">Terceirização</th>
              <th className="px-4 py-3 text-left font-semibold">Adimplência</th>
              <th className="sticky right-0 z-10 bg-slate-50 px-4 py-3 text-right font-semibold shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]">Ações</th>
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
              const ehContaAdmin = c.usuarios.some((u) => u.superAdmin);
              const ehContaTeste = c.contaTeste;
              // Cadastro criado pela importacao de carteira do analista: existe
              // pra a empresa aparecer no painel dele, ninguem loga nela e ela
              // nunca gerou fatura. Sem usuario e sem cobranca e a marca desse
              // caso — quando o cliente assinar de verdade, o signup absorve o
              // cadastro e a conta passa a ter usuario.
              const ehCarteiraImportada =
                c.tipo === "EMPRESA" && c.usuarios.length === 0 && c.cobrancas.length === 0;
              // Conta de super admin (Regina/Igor) nao e cliente: existe pra
              // operar a plataforma e nunca gera fatura. Contar o plano dela
              // como receita inflava o numero — a tela ja marcava "Adm CP" no
              // nome e mesmo assim exibia R$ 997. Analista tambem nao paga.
              // Regra unica (lib/metricasReceita): so entra como receita quem
              // e EMPRESA, nao e conta interna, esta ATIVA e ja pagou fatura —
              // pelo valor da fatura real. Antes o preco vinha de
              // `PREMIUM ? 997 : 397`, e o plano INTERMEDIARIO (R$ 697)
              // aparecia como R$ 397 na tela.
              const mrr =
                ehContaAdmin || ehContaTeste || ehCarteiraImportada ? 0 : contaEhPagante(c) ? mensalidadeDaConta(c) : 0;
              const totalCob = c.cobrancas.length;
              const pagas = c.cobrancas.filter((cb) => cb.status === "PAGA").length;
              const adimplenciaPct = totalCob > 0 ? (pagas / totalCob) * 100 : null;
              const ehMinhaConta = c.usuarios.some((u) => u.id === usuario.id);
              // Regina 11/11: vencimento da fatura EM CIMA de cada cliente, sem
              // precisar rolar a tabela para o lado até a coluna.
              const rcTopo = resumoCob.get(c.id);
              const proxTopo = rcTopo?.proxima ?? (proxDaAssinatura.get(c.id) ? { ...proxDaAssinatura.get(c.id)!, status: "PENDING", forma: null } : null) ?? (!asaas.ok && c.proximoVencimento ? { vencimento: c.proximoVencimento.toISOString().slice(0, 10), valor: null, status: "PENDING", forma: null } : null);
              const semCobTopo = ehContaAdmin || ehContaTeste || ehCarteiraImportada || c.tipo !== "EMPRESA";
              const nomeCurto = c.tipo === "ANALISTA" ? nome : c.empresas[0] ? c.empresas[0].nomeFantasia || c.empresas[0].razaoSocial : nome;
              const razao = c.tipo === "EMPRESA" && c.empresas[0] && c.empresas[0].nomeFantasia && c.empresas[0].nomeFantasia !== c.empresas[0].razaoSocial ? c.empresas[0].razaoSocial : null;
              const fx = faixasConta.get(c.id);
              return (
                <tr key={c.id} className="border-t border-slate-100 align-top transition hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{nomeCurto}</span>
                      {ehContaAdmin && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          <ShieldCheck className="h-2.5 w-2.5" /> Adm CP
                        </span>
                      )}
                      {ehContaTeste && <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Conta de teste</span>}
                      {ehCarteiraImportada && <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Carteira de analista</span>}
                    </div>
                    {razao && <div className="mt-0.5 max-w-[360px] truncate text-xs text-slate-500" title={razao}>{razao}</div>}
                    <div className="mt-0.5 text-xs text-slate-400">
                      {c.tipo === "EMPRESA" ? (c.empresas[0]?.cnpj ? `CNPJ ${c.empresas[0].cnpj}` : "Empresa") : `Analista · ${c.usuarios[0]?.email ?? ""}`}
                      {" · "}
                      {c.embaixador?.nomeCompleto ? `indicação de ${c.embaixador.nomeCompleto}` : "cadastro direto"}
                      {" · desde "}
                      {c.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </div>
                    {!semCobTopo && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rcTopo && rcTopo.emAtraso.length > 0 && (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                            Em atraso desde {dBr(rcTopo.emAtraso[0].vencimento)} · {brl(rcTopo.emAtraso.reduce((t, a) => t + a.valor, 0))}
                          </span>
                        )}
                        {proxTopo ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                            Próxima fatura vence {dBr(proxTopo.vencimento)}
                            {proxTopo.valor != null ? ` · ${brl(proxTopo.valor)}` : ""}
                          </span>
                        ) : c.statusAssinatura === "TRIAL" && c.trialAteEm ? (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200">
                            Em teste até {c.trialAteEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">Sem fatura agendada</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {ehContaTeste ? (
                      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">Não é cliente</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full ${conf.bg} ${conf.cor} px-2.5 py-0.5 text-[11px] font-semibold`}>
                        <Icon className="h-3 w-3" />
                        {conf.rotulo}
                      </span>
                    )}
                    {c.arquivadaEm && <div className="mt-1 text-[11px] text-slate-400">arquivado em {c.arquivadaEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    <div className="font-semibold text-slate-800">{ehContaTeste ? "Demonstração" : c.tipo === "ANALISTA" ? "Analista" : c.plano.charAt(0) + c.plano.slice(1).toLowerCase()}</div>
                    <div className="mt-0.5 tabular-nums text-slate-500">{mrr > 0 ? `${brl(mrr)}/mês` : "sem receita"}</div>
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {semCobTopo ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <dl className="space-y-1.5 whitespace-nowrap">
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Última paga</dt>
                          <dd className="text-slate-700">
                            {rcTopo?.ultimaPaga ? (
                              <>
                                <strong className="text-slate-900">{dBr(rcTopo.ultimaPaga.data)}</strong> · {brl(rcTopo.ultimaPaga.valor)}
                                {rcTopo.ultimaPaga.forma && FORMA[rcTopo.ultimaPaga.forma] ? ` · ${FORMA[rcTopo.ultimaPaga.forma]}` : ""}
                              </>
                            ) : (
                              <span className="text-slate-400">nenhuma ainda</span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Próxima</dt>
                          <dd className="text-slate-700">
                            {proxTopo ? (
                              <>
                                <strong className="text-slate-900">{dBr(proxTopo.vencimento)}</strong> · {proxTopo.valor != null ? brl(proxTopo.valor) : "conforme assinatura"}
                                {proxTopo.forma && FORMA[proxTopo.forma] ? ` · ${FORMA[proxTopo.forma]}` : ""}
                              </>
                            ) : (
                              <span className="text-slate-400">{c.statusAssinatura === "TRIAL" ? "em teste" : "sem cobrança agendada"}</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {fx?.usaModulo ? (
                      <>
                        <div className="font-semibold text-slate-800">{fx.pico} colaborador{fx.pico === 1 ? "" : "es"}</div>
                        <div className="mt-0.5 whitespace-nowrap text-slate-500">
                          faixa {fx.faixa} · {fx.valor > 0 ? brl(fx.valor) : "incluída"}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs whitespace-nowrap">
                    {adimplenciaPct === null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <>
                        <span className={adimplenciaPct >= 90 ? "font-semibold text-emerald-700" : adimplenciaPct >= 70 ? "font-semibold text-amber-700" : "font-semibold text-red-700"}>{adimplenciaPct.toFixed(0)}%</span>
                        <span className="ml-1 text-slate-400">({pagas}/{totalCob} faturas)</span>
                      </>
                    )}
                  </td>
                  <td className="sticky right-0 z-10 bg-white px-4 py-4 text-right shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]">
                    {ehMinhaConta ? (
                      <span className="text-[11px] text-slate-400">você</span>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <form action={entrarEspionagemAction}>
                          <input type="hidden" name="contaId" value={c.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                            title="Entrar no espaço deste cliente em somente leitura"
                          >
                            <Eye className="h-3 w-3" /> Ver como cliente
                          </button>
                        </form>
                        {!ehContaAdmin && <BotaoArquivo contaId={c.id} nome={nomeCurto} arquivada={!!c.arquivadaEm} />}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {contas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
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
