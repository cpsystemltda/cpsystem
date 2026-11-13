import Link from "next/link";
import { ArrowLeft, ArrowRight, Crown, TrendingDown, TrendingUp, Wallet, Landmark, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { SeletorClasse } from "./SeletorClasse";
import { montarDre, rotuloMes, ROTULO_CATEGORIA, CATEGORIAS_DESPESA, type LinhaDre, type CategoriaDespesa } from "@/lib/dre";
import { FormDespesa, BotaoExcluirDespesa } from "./FormDespesa";

export const dynamic = "force-dynamic";

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pct(parte: number, todo: number): string {
  if (!todo) return "—";
  return `${((parte / todo) * 100).toFixed(0)}%`;
}
const dBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const nomeCategoria = (c: string) => (ROTULO_CATEGORIA[(c as CategoriaDespesa) in ROTULO_CATEGORIA ? (c as CategoriaDespesa) : "OUTROS"] ?? c).split(" (")[0];

/**
 * DRE mensal da plataforma (Regina 07/11/2026; refeito em 13/11 — "tem que
 * estar no nível que a CP System merece"). Receita, taxas e saídas vêm do
 * Asaas; despesas pagas fora dele são lançadas aqui. Cálculo em `src/lib/dre.ts`.
 */
export default async function AdminDrePage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Esta área é exclusiva para gestores da plataforma.</p>
      </div>
    );
  }

  const dre = await montarDre();
  const meses = [...dre.meses].reverse(); // mais recente à esquerda
  const categoriasUsadas = CATEGORIAS_DESPESA.filter((c) => (dre.totais.despesas[c] ?? 0) > 0);
  const totalAportes = dre.aportes.reduce((s, a) => s + a.total, 0);
  const aConferir = dre.saidas.filter((s) => s.revisar).length;
  const colunas = meses.length + 2;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* Cabeçalho */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Financeiro
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[34px]">Demonstração do resultado</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Receita, taxas e saídas lidas direto do Asaas, mês a mês. Cada cobrança entra no mês a que se refere; o dinheiro que entrou aparece no memorando.
          </p>
        </div>
        <nav className="flex shrink-0 flex-wrap gap-2 text-sm">
          <Link href="/admin-plataforma" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Visão geral
          </Link>
          <Link href="/admin-plataforma/financeiro" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 transition hover:bg-slate-50">
            MRR <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      {dre.fonte === "ASAAS" ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Asaas lido em {dre.lidoEm?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
        </p>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> O Asaas não respondeu ({dre.fonteErro}). Os números abaixo vêm do registro interno e podem estar desatualizados.
        </p>
      )}

      {/* Indicadores */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icone={<TrendingUp className="h-4 w-4" />} titulo="Receita líquida" valor={brl(dre.totais.receitaLiquida)} sub={`${dre.totais.faturasPagas} fatura${dre.totais.faturasPagas === 1 ? "" : "s"} paga${dre.totais.faturasPagas === 1 ? "" : "s"} · ${dre.totais.clientesPagantes} cliente${dre.totais.clientesPagantes === 1 ? "" : "s"}`} />
        <Kpi icone={<TrendingDown className="h-4 w-4" />} titulo="Despesas e comissões" valor={brl(dre.totais.totalDespesas + dre.totais.comissoes)} sub={`${dre.saidas.length} saída${dre.saidas.length === 1 ? "" : "s"} do Asaas${dre.despesas.length ? ` · ${dre.despesas.length} lançamento${dre.despesas.length === 1 ? "" : "s"} manual` : ""}`} />
        <Kpi
          icone={<Wallet className="h-4 w-4" />}
          titulo="Resultado do período"
          valor={brl(dre.totais.resultado)}
          sub={`margem ${pct(dre.totais.resultado, dre.totais.receitaLiquida)} sobre a receita líquida`}
          tom={dre.totais.resultado >= 0 ? "positivo" : "negativo"}
        />
        <Kpi icone={<Landmark className="h-4 w-4" />} titulo="Aportes dos sócios" valor={brl(totalAportes)} sub="capital colocado na conta · não é receita" />
      </div>

      {/* DRE */}
      <section className="mt-8">
        <TituloSecao titulo="Resultado mês a mês" texto="Mês mais recente à esquerda. Contas de teste e internas ficam de fora; a comissão conta no mês da fatura do cliente." />
        <div className="mt-3 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[780px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                <th className="sticky left-0 z-20 min-w-[210px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold">Linha</th>
                {meses.map((m) => (
                  <th key={m.competencia} className={`whitespace-nowrap border-b border-slate-200 px-3 py-3 text-right font-semibold ${m.competencia === dre.competenciaAtual ? "bg-amber-50/70 text-amber-800" : "bg-slate-50"}`}>
                    {rotuloMes(m.competencia)}
                    {m.competencia === dre.competenciaAtual && <span className="block text-[9px] font-bold tracking-widest text-amber-600">em curso</span>}
                  </th>
                ))}
                <th className="whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-3 text-right font-semibold text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              <Secao titulo="Receitas" colunas={colunas} />
              <Linha rotulo="Receita bruta de assinaturas" meses={meses} total={dre.totais} pega={(l) => l.receitaBruta} atual={dre.competenciaAtual} />
              <Linha rotulo="Faturas pagas" meses={meses} total={dre.totais} pega={(l) => l.faturasPagas} formato="n" mudo atual={dre.competenciaAtual} />
              <Linha rotulo="Clientes pagantes" meses={meses} total={dre.totais} pega={(l) => l.clientesPagantes} formato="n" mudo atual={dre.competenciaAtual} />
              <Linha rotulo="(−) Estornos" meses={meses} total={dre.totais} pega={(l) => l.estornos} negativo atual={dre.competenciaAtual} />
              <Linha rotulo="(−) Taxas do Asaas" meses={meses} total={dre.totais} pega={(l) => l.taxasGateway} negativo atual={dre.competenciaAtual} />
              <Linha rotulo="Receita líquida" meses={meses} total={dre.totais} pega={(l) => l.receitaLiquida} subtotal atual={dre.competenciaAtual} />

              <Secao titulo="Custos variáveis" colunas={colunas} />
              <Linha rotulo="(−) Comissões de analistas" meses={meses} total={dre.totais} pega={(l) => l.comissoes} negativo atual={dre.competenciaAtual} />
              <Linha rotulo="Margem de contribuição" meses={meses} total={dre.totais} pega={(l) => l.margemContribuicao} subtotal atual={dre.competenciaAtual} />

              <Secao titulo="Despesas" colunas={colunas} />
              {categoriasUsadas.length === 0 ? (
                <tr>
                  <td colSpan={colunas} className="border-b border-slate-100 px-5 py-3 text-xs text-slate-400">
                    Nenhuma despesa no período.
                  </td>
                </tr>
              ) : (
                categoriasUsadas.map((c) => <Linha key={c} rotulo={`(−) ${nomeCategoria(c)}`} meses={meses} total={dre.totais} pega={(l) => l.despesas[c] ?? 0} negativo atual={dre.competenciaAtual} />)
              )}
              <Linha rotulo="Total de despesas" meses={meses} total={dre.totais} pega={(l) => l.totalDespesas} negativo subtotal atual={dre.competenciaAtual} />

              <Linha rotulo="Resultado do mês" meses={meses} total={dre.totais} pega={(l) => l.resultado} resultado atual={dre.competenciaAtual} />
              <tr>
                <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-5 py-2.5 text-xs text-slate-500">Margem sobre a receita líquida</td>
                {meses.map((m) => (
                  <td key={m.competencia} className={`border-b border-slate-100 px-4 py-2.5 text-right text-xs tabular-nums text-slate-500 ${m.competencia === dre.competenciaAtual ? "bg-amber-50/40" : ""}`}>
                    {pct(m.resultado, m.receitaLiquida)}
                  </td>
                ))}
                <td className="border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-right text-xs font-semibold tabular-nums text-slate-600">{pct(dre.totais.resultado, dre.totais.receitaLiquida)}</td>
              </tr>

              <Secao titulo="Memorando · não entra no resultado" colunas={colunas} />
              <Linha rotulo="Faturas do mês ainda em aberto" meses={meses} total={dre.totais} pega={(l) => l.aReceber} mudo atual={dre.competenciaAtual} />
              <Linha rotulo="Dinheiro que entrou (líquido)" meses={meses} total={dre.totais} pega={(l) => l.recebidoNoMes} mudo atual={dre.competenciaAtual} />
              <Linha rotulo="Comissões já repassadas" meses={meses} total={dre.totais} pega={(l) => l.comissoesPagas} mudo atual={dre.competenciaAtual} />
              <Linha rotulo="Aportes dos sócios" meses={meses} total={dre.totais} pega={(l) => l.aportesNoMes} mudo atual={dre.competenciaAtual} />
              <Linha rotulo="Retiradas e reembolsos a sócios" meses={meses} total={dre.totais} pega={(l) => l.retiradasNoMes} mudo atual={dre.competenciaAtual} ultima />
            </tbody>
          </table>
        </div>
      </section>

      {/* Saídas do Asaas */}
      <section className="mt-10">
        <TituloSecao
          titulo={`Saídas da conta Asaas · ${dre.saidas.length}`}
          texto="Tudo o que saiu da conta, já somado nas despesas. A categoria vem do destinatário; troque quando estiver errada e o resultado recalcula na hora."
          extra={aConferir > 0 ? <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{aConferir} para conferir</span> : null}
        />
        {dre.saidasErro ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Não foi possível ler o extrato do Asaas ({dre.saidasErro}). As despesas acima mostram só os lançamentos manuais.
          </p>
        ) : (
          <div className="mt-3 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Data</th>
                  <th className="px-4 py-3 text-left font-semibold">Para quem</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-5 py-3 text-left font-semibold">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dre.saidas.map((x) => (
                  <tr key={x.id} className="transition hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-500 tabular-nums">{dBr(x.data)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800">{tituloNome(x.destinatario)}</span>
                        {x.revisar && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">conferir</span>}
                      </div>
                      {x.descricao && <div className="text-xs text-slate-400">{x.descricao}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">{brl(x.valor)}</td>
                    <td className="px-5 py-2.5">
                      <SeletorClasse id={x.id} classe={x.classe} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Aportes */}
      {dre.aportes.length > 0 && (
        <section className="mt-10">
          <TituloSecao titulo="Aportes dos sócios · desde o início" texto="PIX enviados direto para a chave da conta, sem cobrança emitida. É capital dos sócios, não venda: fica fora da receita." />
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dre.aportes.map((a) => (
              <div key={a.pagador} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{tituloNome(a.pagador)}</p>
                  <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {a.quantidade} aporte{a.quantidade === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums">{brl(a.total)}</p>
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  {a.lancamentos.map((x, i) => (
                    <li key={i} className="flex justify-between gap-3 tabular-nums">
                      <span>{dBr(x.data)}</span>
                      <span className="font-medium text-slate-700">{brl(x.valor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex flex-col justify-between rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
              <p className="text-sm font-semibold text-slate-300">Total aportado</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{brl(totalAportes)}</p>
              <p className="mt-3 text-xs text-slate-400">Soma de todos os PIX dos sócios para a conta Asaas.</p>
            </div>
          </div>
        </section>
      )}

      {/* Despesas fora do Asaas */}
      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <TituloSecao titulo="Lançar despesa paga fora do Asaas" texto="Cartão de crédito ou outro banco: Vercel, Anthropic, Neon, Z-API, contador. Para assinatura mensal, use “repetir”." />
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <FormDespesa competenciaAtual={dre.competenciaAtual} />
          </div>
        </div>
        <div className="min-w-0">
          <TituloSecao titulo={`Lançamentos manuais · ${dre.despesas.length}`} />
          <div className="mt-3 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Mês</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                  <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dre.despesas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">
                      Nenhuma despesa lançada à mão até agora.
                    </td>
                  </tr>
                ) : (
                  dre.despesas.map((d) => (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">{rotuloMes(d.competencia)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{nomeCategoria(d.categoria)}</td>
                      <td className="px-4 py-2.5 text-slate-800">{d.descricao}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-slate-800">{brl(d.valor)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <BotaoExcluirDespesa id={d.id} descricao={`${d.descricao} (${rotuloMes(d.competencia)})`} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/** "GOOGLE CLOUD BRASIL LTDA." → "Google Cloud Brasil Ltda." (nomes do banco vêm em caixa alta). */
function tituloNome(s: string): string {
  if (s !== s.toUpperCase()) return s;
  const minusculas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && minusculas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

function TituloSecao({ titulo, texto, extra }: { titulo: string; texto?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
        {texto && <p className="mt-0.5 max-w-3xl text-xs text-slate-500">{texto}</p>}
      </div>
      {extra}
    </div>
  );
}

function Kpi({ icone, titulo, valor, sub, tom }: { icone: React.ReactNode; titulo: string; valor: string; sub?: string; tom?: "positivo" | "negativo" }) {
  const cor = tom === "positivo" ? "text-emerald-700" : tom === "negativo" ? "text-rose-600" : "text-slate-900";
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-700">{icone}</span>
        {titulo}
      </div>
      <p className={`mt-3 truncate text-[26px] font-extrabold leading-none tracking-tight tabular-nums ${cor}`}>{valor}</p>
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Secao({ titulo, colunas }: { titulo: string; colunas: number }) {
  return (
    <tr>
      <td colSpan={colunas} className="border-b border-slate-100 bg-slate-50/60 px-5 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
        <span className="sticky left-5">{titulo}</span>
      </td>
    </tr>
  );
}

function Linha({
  rotulo,
  meses,
  total,
  pega,
  atual,
  formato = "brl",
  negativo,
  subtotal,
  resultado,
  mudo,
  ultima,
}: {
  rotulo: string;
  meses: LinhaDre[];
  total: Omit<LinhaDre, "competencia">;
  pega: (l: LinhaDre | Omit<LinhaDre, "competencia">) => number;
  atual: string;
  formato?: "brl" | "n";
  /** Dedução: valor com sinal de menos. */
  negativo?: boolean;
  /** Subtotal: negrito com fundo leve. */
  subtotal?: boolean;
  /** Resultado: verde/vermelho, destaque. */
  resultado?: boolean;
  /** Informativa: cinza. */
  mudo?: boolean;
  ultima?: boolean;
}) {
  const fmt = (n: number) => (formato === "n" ? String(n) : brl(Math.abs(n)));
  const texto = (n: number) => {
    if (n === 0) return "—";
    if (resultado) return n < 0 ? `−${fmt(n)}` : fmt(n);
    if (negativo) return `−${fmt(n)}`;
    return formato === "n" ? String(n) : brl(n);
  };
  const cor = (n: number) => {
    if (n === 0) return "text-slate-300";
    if (resultado) return n > 0 ? "text-emerald-700" : "text-rose-600";
    if (mudo) return "text-slate-500";
    if (negativo) return "text-rose-600/90";
    return "text-slate-800";
  };
  const fundo = resultado ? "bg-slate-900/[0.03]" : subtotal ? "bg-slate-50/80" : "";
  const borda = ultima ? "" : "border-b border-slate-100";
  const peso = resultado ? "font-extrabold" : subtotal ? "font-bold" : "font-medium";
  return (
    <tr className={resultado ? "text-[15px]" : ""}>
      <td className={`sticky left-0 z-10 whitespace-nowrap px-4 py-2.5 ${borda} ${resultado || subtotal ? "font-bold text-slate-900" : mudo ? "text-slate-500" : "text-slate-700"} ${resultado ? "bg-slate-100" : subtotal ? "bg-slate-50" : "bg-white"}`}>
        {rotulo}
      </td>
      {meses.map((m) => {
        const n = pega(m);
        return (
          <td key={m.competencia} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${borda} ${peso} ${cor(n)} ${fundo} ${m.competencia === atual ? "bg-amber-50/40" : ""}`}>
            {texto(n)}
          </td>
        );
      })}
      <td className={`whitespace-nowrap bg-slate-50 px-4 py-2.5 text-right tabular-nums ${borda} ${resultado || subtotal ? "font-extrabold" : "font-semibold"} ${cor(pega(total))}`}>{texto(pega(total))}</td>
    </tr>
  );
}
