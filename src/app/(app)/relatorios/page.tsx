import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { calcularSaldoAta } from "@/lib/saldo";
import { BarChart3, TrendingUp, Building2, AlertTriangle, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/SecaoGlass";

export default async function RelatoriosPage() {
  const usuario = await exigirUsuario();
  const contaId = usuario.contaId;

  const [empresas, atas, contratos, empenhos] = await Promise.all([
    prisma.empresa.findMany({
      where: { contaId },
      include: {
        _count: { select: { atas: true, contratos: true, empenhos: true } },
      },
    }),
    prisma.ata.findMany({
      where: { empresa: { contaId } },
      select: { id: true, numero: true, vigenciaFim: true, marcoOrcamentoEstimado: true, orgaoNome: true },
    }),
    prisma.contrato.findMany({
      where: { empresa: { contaId } },
      include: { itens: { select: { valorTotal: true } } },
    }),
    prisma.empenho.findMany({
      where: { empresa: { contaId } },
      include: { itens: { select: { valorTotal: true } } },
    }),
  ]);

  const valorTotalContratos = contratos.reduce(
    (s, c) => s + c.itens.reduce((s2, i) => s2 + i.valorTotal, 0),
    0,
  );
  const valorTotalEmpenhos = empenhos.reduce(
    (s, e) => s + e.itens.reduce((s2, i) => s2 + i.valorTotal, 0),
    0,
  );
  // "A receber" granular por estágio do funil financeiro (Regina pediu):
  //   - Empenhado: orçamento alocado mas execução ainda nem começou
  //   - Em execução: pedido recebido / trânsito / entregue (sem NF ainda)
  //   - Faturado: NF emitida ou encaminhada (já cobrado, esperando $)
  //   - Recebido: empenho PAGO pelo órgão
  // Antes era apenas total − pago = "a receber" — englobava até empenhos
  // sem execução iniciada e inflava artificialmente a expectativa de caixa.
  function somar(estados: readonly string[]): number {
    return empenhos
      .filter((e) => estados.includes(e.status))
      .reduce((s, e) => s + e.itens.reduce((s2, i) => s2 + i.valorTotal, 0), 0);
  }
  const valorEmpenhado = somar(["EMPENHADO"]);
  const valorEmExecucao = somar(["PEDIDO_RECEBIDO", "EM_TRANSITO", "ENTREGUE"]);
  const valorFaturado = somar(["NF_EMITIDA", "NF_ENCAMINHADA"]);
  const valorPago = somar(["PAGO"]);
  const valorReceber = valorEmpenhado + valorEmExecucao + valorFaturado; // total ainda não recebido

  const saldosAtas = await Promise.all(atas.map((a) => calcularSaldoAta(a.id)));
  const valorTotalAtas = saldosAtas.reduce((s, sa) => s + sa.valorTotal, 0);
  const valorDisponivelAtas = saldosAtas.reduce((s, sa) => s + sa.valorDisponivel, 0);

  // Alertas
  const hoje = Date.now();
  const atasVencendo = atas.filter((a) => {
    const dias = (a.vigenciaFim.getTime() - hoje) / 86400000;
    return dias > 0 && dias <= 90;
  });
  const reajustes = atas.filter((a) => {
    if (!a.marcoOrcamentoEstimado) return false;
    const janela = a.marcoOrcamentoEstimado.getTime() + 365 * 86400000;
    const dias = (janela - hoje) / 86400000;
    return dias >= 0 && dias <= 60;
  });

  // Por status de empenho
  const porStatus = empenhos.reduce<Record<string, { qtd: number; valor: number }>>((acc, e) => {
    const v = e.itens.reduce((s, i) => s + i.valorTotal, 0);
    if (!acc[e.status]) acc[e.status] = { qtd: 0, valor: 0 };
    acc[e.status].qtd++;
    acc[e.status].valor += v;
    return acc;
  }, {});

  const ROTULO_STATUS: Record<string, string> = {
    EMPENHADO: "Empenhado",
    PEDIDO_RECEBIDO: "Pedido recebido",
    EM_TRANSITO: "Em trânsito/Em execução",
    ENTREGUE: "Entregue",
    NF_EMITIDA: "NF emitida",
    NF_ENCAMINHADA: "NF encaminhada",
    PAGO: "Pago",
  };

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <PageHeader
        eyebrow="Insights · Performance consolidada"
        titulo="Relatórios de"
        destaque="gestão"
        subtitulo="Visão consolidada de toda a operação pública."
        cta={
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/atas" className="btn-secondary inline-flex">
              <Download className="h-3.5 w-3.5" /> Atas (CSV)
            </a>
            <a href="/api/export/contratos" className="btn-secondary inline-flex">
              <Download className="h-3.5 w-3.5" /> Contratos (CSV)
            </a>
            <a href="/api/export/empenhos" className="btn-secondary inline-flex">
              <Download className="h-3.5 w-3.5" /> Empenhos (CSV)
            </a>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card icone={Building2} cor="blue" titulo="Atas — valor registrado" valor={brl(valorTotalAtas)} sub={`${atas.length} atas`} />
        <Card icone={TrendingUp} cor="emerald" titulo="Contratos — valor total" valor={brl(valorTotalContratos)} sub={`${contratos.length} contratos`} />
        <Card icone={TrendingUp} cor="amber" titulo="Valor empenhado" valor={brl(valorTotalEmpenhos)} sub={`${empenhos.length} empenhos`} />
        <Card
          icone={TrendingUp}
          cor="violet"
          titulo="Já recebido"
          valor={brl(valorPago)}
          sub={
            valorReceber > 0
              ? `${brl(valorReceber)} ainda a receber (ver funil abaixo)`
              : `tudo recebido · 0 a receber`
          }
        />
      </div>

      {/* Funil financeiro — quebra o "a receber" por estágio para evitar
          inflar a expectativa de caixa com empenhos sem execução iniciada. */}
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Card
          icone={TrendingUp}
          cor="amber"
          titulo="Empenhado"
          valor={brl(valorEmpenhado)}
          sub="Orçamento alocado · execução não iniciada"
        />
        <Card
          icone={TrendingUp}
          cor="blue"
          titulo="Em execução"
          valor={brl(valorEmExecucao)}
          sub="Pedido recebido até entregue · sem NF"
        />
        <Card
          icone={TrendingUp}
          cor="rose"
          titulo="Faturado · aguardando pagamento"
          valor={brl(valorFaturado)}
          sub="NF emitida ou encaminhada · curto prazo"
        />
        <Card
          icone={TrendingUp}
          cor="emerald"
          titulo="Recebido"
          valor={brl(valorPago)}
          sub="Empenho pago pelo órgão"
        />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="glass rounded-[20px] px-6 py-5">
          <h2
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Empenhos por status
          </h2>
          {Object.keys(porStatus).length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: "var(--text-mute)" }}>
              Sem dados ainda.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(porStatus).map(([status, dados]) => {
                const pct = (dados.valor / valorTotalEmpenhos) * 100;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold" style={{ color: "var(--text)" }}>{ROTULO_STATUS[status]}</span>
                      <span style={{ color: "var(--text-soft)" }}>
                        {dados.qtd} · {brl(dados.valor)}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-2 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(15,14,12,0.06)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: "var(--primary-deep)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass rounded-[20px] px-6 py-5">
          <h2
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Atas — saldo disponível
          </h2>
          <p
            className="mt-3 text-[28px] font-extrabold leading-none tabular"
            style={{ color: "var(--mint-deep)", letterSpacing: "-0.025em" }}
          >
            {brl(valorDisponivelAtas)}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
            de {brl(valorTotalAtas)} registrado em {atas.length} atas vigentes ou em vigor.
          </p>
          <div
            className="mt-4 h-3 w-full overflow-hidden rounded-full"
            style={{ background: "rgba(15,14,12,0.06)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${valorTotalAtas ? (valorDisponivelAtas / valorTotalAtas) * 100 : 0}%`,
                background: "var(--mint-deep)",
              }}
            />
          </div>
        </section>
      </div>

      {(atasVencendo.length > 0 || reajustes.length > 0) && (
        <section
          className="glass mt-8 rounded-[20px] px-6 py-5"
          style={{
            background: "rgba(212,175,55,0.08)",
            border: "0.5px solid rgba(168,137,71,0.30)",
          }}
        >
          <h2
            className="flex items-center gap-2 text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            <AlertTriangle className="h-4 w-4" /> Alertas críticos ({atasVencendo.length + reajustes.length})
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {atasVencendo.map((a) => (
              <div
                key={a.id}
                className="glass-tile rounded-[14px] px-4 py-3 text-sm"
              >
                <p className="font-bold" style={{ color: "var(--text)" }}>
                  Ata {a.numero} vence em {Math.ceil((a.vigenciaFim.getTime() - hoje) / 86400000)} dias
                </p>
                <p className="text-xs" style={{ color: "var(--text-soft)" }}>{a.orgaoNome}</p>
              </div>
            ))}
            {reajustes.map((a) => {
              const janela = a.marcoOrcamentoEstimado!.getTime() + 365 * 86400000;
              const dias = Math.ceil((janela - hoje) / 86400000);
              return (
                <div
                  key={`r-${a.id}`}
                  className="glass-tile rounded-[14px] px-4 py-3 text-sm"
                >
                  <p className="font-bold" style={{ color: "var(--text)" }}>
                    Reajuste de preços disponível em {dias}d (Ata {a.numero})
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                    Marco orçamento: {a.marcoOrcamentoEstimado!.toLocaleDateString("pt-BR")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="glass mt-8 overflow-hidden rounded-[20px]">
        <header
          className="px-6 py-4"
          style={{ borderBottom: "0.5px solid var(--hairline)" }}
        >
          <h2
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Por empresa do grupo
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="table-glass">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th className="num">Atas</th>
                <th className="num">Contratos</th>
                <th className="num">Empenhos</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td className="strong">{e.nomeFantasia || e.razaoSocial}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--text-soft)" }}>{e.cnpj}</td>
                  <td className="num">{e._count.atas}</td>
                  <td className="num">{e._count.contratos}</td>
                  <td className="num">{e._count.empenhos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({
  icone: Icone,
  cor,
  titulo,
  valor,
  sub,
}: {
  icone: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  cor: "blue" | "emerald" | "amber" | "violet" | "rose";
  titulo: string;
  valor: string;
  sub: string;
}) {
  // Mapeia para tonalidades do design system (Liquid Glass)
  const tone =
    cor === "blue" ? "t-sky" :
    cor === "emerald" ? "t-mint" :
    cor === "amber" ? "t-primary" :
    cor === "rose" ? "t-coral" :
    "t-lavender";
  const tint =
    cor === "blue" ? { bg: "rgba(184,197,214,0.20)", color: "#365175" } :
    cor === "emerald" ? { bg: "rgba(93,216,182,0.20)", color: "var(--mint-deep)" } :
    cor === "amber" ? { bg: "rgba(212,175,55,0.20)", color: "var(--primary-deep)" } :
    cor === "rose" ? { bg: "rgba(232,138,152,0.20)", color: "var(--coral)" } :
    { bg: "rgba(197,180,255,0.22)", color: "#8E73E0" };

  return (
    <div className={`glass-tile ${tone} relative overflow-hidden rounded-[20px] px-6 py-5`}>
      <div className="kpi-aura" />
      <div className="relative z-[1]">
        <div className="flex items-center justify-between">
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            {titulo}
          </p>
          <div
            className="grid h-8 w-8 place-items-center rounded-[10px]"
            style={{ background: tint.bg }}
          >
            <Icone className="h-4 w-4" style={{ color: tint.color }} />
          </div>
        </div>
        <p
          className="mt-3 text-[24px] font-extrabold leading-none tabular"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {valor}
        </p>
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-soft)" }}>
          {sub}
        </p>
      </div>
    </div>
  );
}
