import Link from "next/link";
import { Crown } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
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

/**
 * DRE mensal da plataforma (Regina 07/11/2026). Regime de competência; o que
 * o banco sabe (faturas pagas, estornos, comissões) vem sozinho, o resto
 * (infra, IA, ferramentas, marketing, contador, impostos) é lançado aqui.
 * Explicação completa em `src/lib/dre.ts`.
 */
export default async function AdminDrePage() {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Acesso restrito</h1>
        <p className="mt-3 text-sm text-slate-600">Esta área é exclusiva para gestores da plataforma.</p>
      </div>
    );
  }

  const dre = await montarDre();
  // Mais recente à esquerda: é o mês que interessa; os anteriores servem de comparação.
  const meses = [...dre.meses].reverse();
  const categoriasUsadas = CATEGORIAS_DESPESA.filter((c) => (dre.totais.despesas[c] ?? 0) > 0);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="glass mb-6 flex items-end justify-between gap-6 rounded-[24px] px-7 py-5">
        <div className="relative z-[1]">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase" style={{ letterSpacing: "0.22em", color: "var(--primary-deep)" }}>
            <Crown className="h-3.5 w-3.5" /> Adm CP System · Financeiro
          </p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-none" style={{ color: "var(--text)", letterSpacing: "-0.04em" }}>
            DRE{" "}
            <em style={{ fontStyle: "normal", background: "linear-gradient(135deg, var(--primary-deep), var(--primary))", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              mensal
            </em>
          </h1>
          <p className="mt-2 max-w-[720px] text-[14px]" style={{ color: "var(--text-soft)" }}>
            Regime de competência: cada valor pertence ao mês de vencimento da cobrança. A receita, as taxas, os estornos e o que está em
            aberto vêm direto do Asaas; comissões vêm dos repasses registrados; as despesas da plataforma são lançadas abaixo, por mês.
          </p>
          {dre.fonte === "ASAAS" ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              ● Dados do Asaas lidos em {dre.lidoEm?.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
              {dre.semCliente.length > 0 && ` · ${dre.semCliente.length} cobrança(s) sem cliente correspondente no CP System`}
            </p>
          ) : (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
              Asaas não respondeu ({dre.fonteErro}). Os números abaixo são do registro interno e podem estar desatualizados.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-sm font-semibold">
          <Link href="/admin-plataforma/financeiro" className="transition hover:opacity-70" style={{ color: "var(--text-soft)" }}>
            Dashboard de BI (MRR) →
          </Link>
          <Link href="/admin-plataforma" className="transition hover:opacity-70" style={{ color: "var(--text-soft)" }}>
            ← Voltar à visão geral
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <Kpi titulo="Receita líquida acumulada" valor={brl(dre.totais.receitaLiquida)} sub={`${dre.totais.faturasPagas} fatura(s) paga(s) · ${dre.totais.clientesPagantes} cliente(s)`} />
        <Kpi titulo="Comissões (período)" valor={brl(dre.totais.comissoes)} sub={`${brl(dre.totais.comissoesPagas)} já repassadas`} />
        <Kpi titulo="Despesas lançadas" valor={brl(dre.totais.totalDespesas)} sub={`${dre.despesas.length} lançamento(s)`} />
        <Kpi
          titulo="Resultado acumulado"
          valor={brl(dre.totais.resultado)}
          sub={`margem ${pct(dre.totais.resultado, dre.totais.receitaLiquida)} sobre a receita líquida`}
          destaque={dre.totais.resultado >= 0 ? "positivo" : "negativo"}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-[12px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}>
          Demonstração do resultado por mês
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
          Mês mais recente à esquerda. Faturas de teste e contas internas (Regina/Igor) ficam de fora. Comissão conta no mês da
          fatura do cliente, mesmo que o PIX do repasse saia depois.
        </p>
        <div className="glass mt-3 overflow-x-auto rounded-[20px]">
          <table className="table-glass min-w-[720px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1]" style={{ background: "var(--glass-2)" }}>Linha</th>
                {meses.map((m) => (
                  <th key={m.competencia} className="num whitespace-nowrap">
                    {rotuloMes(m.competencia)}
                    {m.competencia === dre.competenciaAtual && (
                      <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: "rgba(212,175,55,0.2)", color: "var(--primary-deep)" }}>
                        atual
                      </span>
                    )}
                  </th>
                ))}
                <th className="num whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody>
              <Secao titulo="Receitas" colunas={meses.length + 2} />
              <Linha rotulo="Receita bruta de assinaturas" meses={meses} total={dre.totais} pega={(l) => l.receitaBruta} />
              <Linha rotulo="Faturas pagas" meses={meses} total={dre.totais} pega={(l) => l.faturasPagas} formato="n" mudo />
              <Linha rotulo="Clientes pagantes" meses={meses} total={dre.totais} pega={(l) => l.clientesPagantes} formato="n" mudo />
              <Linha rotulo="(−) Estornos" meses={meses} total={dre.totais} pega={(l) => l.estornos} negativo />
              <Linha rotulo="(−) Taxas do Asaas" meses={meses} total={dre.totais} pega={(l) => l.taxasGateway} negativo />
              <Linha rotulo="= Receita líquida" meses={meses} total={dre.totais} pega={(l) => l.receitaLiquida} forte />

              <Secao titulo="Custos variáveis" colunas={meses.length + 2} />
              <Linha rotulo="(−) Comissões de analistas e indicadores" meses={meses} total={dre.totais} pega={(l) => l.comissoes} negativo />
              <Linha rotulo="= Margem de contribuição" meses={meses} total={dre.totais} pega={(l) => l.margemContribuicao} forte />

              <Secao titulo="Despesas da plataforma" colunas={meses.length + 2} />
              {categoriasUsadas.length === 0 ? (
                <tr>
                  <td colSpan={meses.length + 2} className="text-xs" style={{ color: "var(--text-mute)", padding: "10px 16px" }}>
                    Nenhuma despesa lançada ainda. Use o formulário abaixo: Vercel, Neon, Anthropic, Z-API, Google Ads, contador, impostos.
                  </td>
                </tr>
              ) : (
                categoriasUsadas.map((c) => (
                  <Linha key={c} rotulo={`(−) ${ROTULO_CATEGORIA[c]}`} meses={meses} total={dre.totais} pega={(l) => l.despesas[c] ?? 0} negativo />
                ))
              )}
              <Linha rotulo="= Total de despesas" meses={meses} total={dre.totais} pega={(l) => l.totalDespesas} negativo forte />

              <Secao titulo="Resultado" colunas={meses.length + 2} />
              <Linha rotulo="= Resultado do mês" meses={meses} total={dre.totais} pega={(l) => l.resultado} forte sinal />
              <tr>
                <td className="sticky left-0 z-[1] text-xs" style={{ background: "var(--glass-2)", color: "var(--text-soft)" }}>Margem sobre a receita líquida</td>
                {meses.map((m) => (
                  <td key={m.competencia} className="num text-xs" style={{ color: "var(--text-soft)" }}>{pct(m.resultado, m.receitaLiquida)}</td>
                ))}
                <td className="num text-xs" style={{ color: "var(--text-soft)" }}>{pct(dre.totais.resultado, dre.totais.receitaLiquida)}</td>
              </tr>

              <Secao titulo="Memorando (não entra no resultado)" colunas={meses.length + 2} />
              <Linha rotulo="Faturas da competência ainda em aberto" meses={meses} total={dre.totais} pega={(l) => l.aReceber} mudo />
              <Linha rotulo="Dinheiro que entrou no mês (líquido, data do pagamento)" meses={meses} total={dre.totais} pega={(l) => l.recebidoNoMes} mudo />
              <Linha rotulo="Comissões já repassadas por PIX" meses={meses} total={dre.totais} pega={(l) => l.comissoesPagas} mudo />
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div>
          <h2 className="text-[12px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}>
            Lançar despesa
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Informe o mês a que a despesa se refere. Para assinatura mensal, use “repetir” e ela entra nos meses seguintes de uma vez.
          </p>
          <div className="glass mt-3 rounded-[20px] px-5 py-5">
            <FormDespesa competenciaAtual={dre.competenciaAtual} />
          </div>
        </div>
        <div>
          <h2 className="text-[12px] font-bold uppercase" style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}>
            Lançamentos ({dre.despesas.length})
          </h2>
          <div className="glass mt-3 overflow-hidden rounded-[20px]">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th className="num">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dre.despesas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="center" style={{ padding: "32px 24px", color: "var(--text-mute)" }}>
                      Nenhum lançamento.
                    </td>
                  </tr>
                ) : (
                  dre.despesas.map((d) => (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap">{rotuloMes(d.competencia)}</td>
                      <td className="text-xs" style={{ color: "var(--text-soft)" }}>
                        {ROTULO_CATEGORIA[(d.categoria as CategoriaDespesa) in ROTULO_CATEGORIA ? (d.categoria as CategoriaDespesa) : "OUTROS"].split(" (")[0]}
                      </td>
                      <td>{d.descricao}</td>
                      <td className="num">{brl(d.valor)}</td>
                      <td className="num">
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

function Kpi({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub?: string; destaque?: "positivo" | "negativo" }) {
  const cor = destaque === "positivo" ? "var(--mint-deep)" : destaque === "negativo" ? "var(--coral-deep)" : "var(--text)";
  return (
    <div className="glass-tile relative overflow-hidden rounded-[18px] px-5 py-5">
      <h3 className="text-[13px] font-bold" style={{ color: "var(--text-soft)" }}>{titulo}</h3>
      <p className="mt-2 text-[28px] font-extrabold tabular leading-none" style={{ color: cor, letterSpacing: "-0.04em" }}>{valor}</p>
      {sub && <p className="mt-2 text-[12px] font-semibold" style={{ color: "var(--text-soft)" }}>{sub}</p>}
    </div>
  );
}

function Secao({ titulo, colunas }: { titulo: string; colunas: number }) {
  return (
    <tr>
      <td colSpan={colunas} className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.16em", color: "var(--primary-deep)", background: "rgba(212,175,55,0.07)", padding: "8px 16px" }}>
        {titulo}
      </td>
    </tr>
  );
}

function Linha({
  rotulo,
  meses,
  total,
  pega,
  formato = "brl",
  negativo,
  forte,
  mudo,
  sinal,
}: {
  rotulo: string;
  meses: LinhaDre[];
  total: Omit<LinhaDre, "competencia">;
  pega: (l: LinhaDre | Omit<LinhaDre, "competencia">) => number;
  formato?: "brl" | "n";
  /** Linha de dedução: mostra em vermelho suave quando há valor. */
  negativo?: boolean;
  /** Subtotal: negrito. */
  forte?: boolean;
  /** Informativa: cinza. */
  mudo?: boolean;
  /** Resultado: verde se positivo, vermelho se negativo. */
  sinal?: boolean;
}) {
  const fmt = (n: number) => (formato === "n" ? String(n) : brl(n));
  const cor = (n: number) => {
    if (sinal) return n > 0 ? "var(--mint-deep)" : n < 0 ? "var(--coral-deep)" : "var(--text-mute)";
    if (mudo) return "var(--text-mute)";
    if (negativo) return n > 0 ? "var(--coral-deep)" : "var(--text-mute)";
    return n === 0 ? "var(--text-mute)" : "var(--text)";
  };
  const celula = (n: number, chave: string) => (
    <td key={chave} className="num whitespace-nowrap" style={{ color: cor(n), fontWeight: forte ? 700 : 500 }}>
      {negativo && n > 0 ? `− ${fmt(n)}` : fmt(n)}
    </td>
  );
  return (
    <tr>
      <td className={`sticky left-0 z-[1] ${forte ? "strong" : ""}`} style={{ background: "var(--glass-2)", color: mudo ? "var(--text-soft)" : "var(--text)" }}>
        {rotulo}
      </td>
      {meses.map((m) => celula(pega(m), m.competencia))}
      {celula(pega(total), "total")}
    </tr>
  );
}
