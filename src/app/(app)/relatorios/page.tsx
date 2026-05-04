import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { calcularSaldoAta } from "@/lib/saldo";
import { BarChart3, TrendingUp, Building2, AlertTriangle, Download } from "lucide-react";

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
  const valorPago = empenhos
    .filter((e) => e.status === "PAGO")
    .reduce((s, e) => s + e.itens.reduce((s2, i) => s2 + i.valorTotal, 0), 0);
  const valorReceber = valorTotalEmpenhos - valorPago;

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
    EM_TRANSITO: "Em trânsito",
    ENTREGUE: "Entregue",
    NF_EMITIDA: "NF emitida",
    NF_ENCAMINHADA: "NF encaminhada",
    PAGO: "Pago",
  };

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-violet-50">
            <BarChart3 className="h-5 w-5 text-violet-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Relatórios de gestão</h1>
            <p className="mt-1 text-sm text-slate-600">Visão consolidada de toda a operação pública.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export/atas"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3 w-3" /> Atas (CSV)
          </a>
          <a
            href="/api/export/contratos"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3 w-3" /> Contratos (CSV)
          </a>
          <a
            href="/api/export/empenhos"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3 w-3" /> Empenhos (CSV)
          </a>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card icone={Building2} cor="blue" titulo="Atas — valor registrado" valor={brl(valorTotalAtas)} sub={`${atas.length} atas`} />
        <Card icone={TrendingUp} cor="emerald" titulo="Contratos — valor total" valor={brl(valorTotalContratos)} sub={`${contratos.length} contratos`} />
        <Card icone={TrendingUp} cor="amber" titulo="Valor empenhado" valor={brl(valorTotalEmpenhos)} sub={`${empenhos.length} empenhos`} />
        <Card icone={TrendingUp} cor="violet" titulo="Já recebido" valor={brl(valorPago)} sub={`${brl(valorReceber)} a receber`} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Empenhos por status</h2>
          {Object.keys(porStatus).length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Sem dados ainda.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(porStatus).map(([status, dados]) => {
                const pct = (dados.valor / valorTotalEmpenhos) * 100;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{ROTULO_STATUS[status]}</span>
                      <span className="text-slate-600">
                        {dados.qtd} · {brl(dados.valor)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Atas — saldo disponível</h2>
          <p className="mt-4 text-3xl font-bold text-slate-900">{brl(valorDisponivelAtas)}</p>
          <p className="mt-1 text-xs text-slate-500">
            de {brl(valorTotalAtas)} registrado em {atas.length} atas vigentes ou em vigor.
          </p>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${valorTotalAtas ? (valorDisponivelAtas / valorTotalAtas) * 100 : 0}%` }}
            />
          </div>
        </section>
      </div>

      {(atasVencendo.length > 0 || reajustes.length > 0) && (
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Alertas críticos ({atasVencendo.length + reajustes.length})
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {atasVencendo.map((a) => (
              <div key={a.id} className="rounded-md border border-amber-200 bg-white p-3 text-sm">
                <p className="font-medium">Ata {a.numero} vence em {Math.ceil((a.vigenciaFim.getTime() - hoje) / 86400000)} dias</p>
                <p className="text-xs text-slate-500">{a.orgaoNome}</p>
              </div>
            ))}
            {reajustes.map((a) => {
              const janela = a.marcoOrcamentoEstimado!.getTime() + 365 * 86400000;
              const dias = Math.ceil((janela - hoje) / 86400000);
              return (
                <div key={`r-${a.id}`} className="rounded-md border border-amber-200 bg-white p-3 text-sm">
                  <p className="font-medium">Reajuste de preços disponível em {dias}d (Ata {a.numero})</p>
                  <p className="text-xs text-slate-500">Marco orçamento: {a.marcoOrcamentoEstimado!.toLocaleDateString("pt-BR")}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Por empresa do grupo</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">CNPJ</th>
                <th className="px-3 py-2 text-right">Atas</th>
                <th className="px-3 py-2 text-right">Contratos</th>
                <th className="px-3 py-2 text-right">Empenhos</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{e.nomeFantasia || e.razaoSocial}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-xs">{e.cnpj}</td>
                  <td className="px-3 py-2 text-right">{e._count.atas}</td>
                  <td className="px-3 py-2 text-right">{e._count.contratos}</td>
                  <td className="px-3 py-2 text-right">{e._count.empenhos}</td>
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
  icone: React.ComponentType<{ className?: string }>;
  cor: "blue" | "emerald" | "amber" | "violet";
  titulo: string;
  valor: string;
  sub: string;
}) {
  const cores = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
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
