import { TrendingUp, Wallet, Truck, FileSignature, Clock, AlertTriangle, Download } from "lucide-react";
import Link from "next/link";
import { brl } from "@/lib/validators";
import { BotaoImprimirRelatorio } from "@/components/BotaoImprimirRelatorio";

/**
 * Relatório consolidado de uma contratação (Contrato ou Empenho).
 * Mostra indicadores macro: financeiro, execução física, prazos e marcos.
 */
type Item = { quantidade: number; valorTotal: number };

type DadosContrato = {
  numero: string;
  vigenciaInicio: Date;
  vigenciaFim: Date;
  dataAssinatura?: Date;
  dataEmissao?: Date;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  marcoOrcamentoEstimado?: Date | null;
  itens: Item[];
};

type Saldo = {
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
  percentualUsado: number;
};

type Aditivo = {
  alteraValor: boolean;
  novoValor: number | null;
  alteraPrazoVigencia: boolean;
  novaVigenciaFim: Date | null;
};

/** id do recurso pra link de imprimir/baixar PDF — só funciona pra Contrato. */
type PdfLink = { tipo: "contrato"; id: string };

export function RelatorioContratacao({
  contrato,
  saldo,
  qtdEmpenhos,
  empenhosPagos,
  qtdAditivos,
  aditivos,
  qtdApostilamentos,
  qtdReajustes,
  qtdNotificacoes,
  qtdProcedimentos,
  rotuloRecurso,
  pdfLink,
}: {
  contrato: DadosContrato;
  saldo?: Saldo;
  qtdEmpenhos: number;
  empenhosPagos: number;
  qtdAditivos: number;
  aditivos?: Aditivo[];
  qtdApostilamentos: number;
  qtdReajustes: number;
  qtdNotificacoes: number;
  qtdProcedimentos: number;
  rotuloRecurso: "Contrato" | "Empenho";
  pdfLink?: PdfLink;
}) {
  const valorContratado = contrato.itens.reduce((s, i) => s + i.valorTotal, 0);
  const qtdItens = contrato.itens.length;

  const hoje = new Date();
  const diasAteVencer = Math.ceil((contrato.vigenciaFim.getTime() - hoje.getTime()) / 86400000);
  const vigenciaTotalDias = Math.ceil(
    (contrato.vigenciaFim.getTime() - contrato.vigenciaInicio.getTime()) / 86400000,
  );
  const diasDecorridos = Math.max(0, vigenciaTotalDias - diasAteVencer);
  const pctTempoDecorrido = vigenciaTotalDias > 0 ? Math.min(100, (diasDecorridos / vigenciaTotalDias) * 100) : 0;

  // Janela de reajuste: marcoOrcamentoEstimado + 1 ano
  const janelaReajuste = contrato.marcoOrcamentoEstimado
    ? new Date(contrato.marcoOrcamentoEstimado.getTime() + 365 * 86400000)
    : null;
  const diasParaReajuste = janelaReajuste
    ? Math.ceil((janelaReajuste.getTime() - hoje.getTime()) / 86400000)
    : null;

  // Soma de aditivos por tipo
  const aditivosValor = (aditivos || []).filter((a) => a.alteraValor).length;
  const aditivosPrazo = (aditivos || []).filter((a) => a.alteraPrazoVigencia).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de exportar PDF */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2
            className="text-[15px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
          >
            Relatório consolidado
          </h2>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-soft)" }}>
            Resumo financeiro, físico, prazos e movimentos contratuais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BotaoImprimirRelatorio />
          {pdfLink?.tipo === "contrato" && (
            <Link
              href={`/contratos/${pdfLink.id}/imprimir`}
              target="_blank"
              className="btn-primary inline-flex"
            >
              <Download className="h-4 w-4" /> Baixar PDF formatado
            </Link>
          )}
        </div>
      </header>

      {/* Cards financeiros */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Posição financeira
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <KpiBlock
            icone={Wallet}
            cor="from-slate-700 to-slate-900"
            titulo="Valor contratado"
            valor={brl(saldo?.valorTotal ?? valorContratado)}
            sub={`${qtdItens} item(ns) · soma das linhas`}
          />
          <KpiBlock
            icone={TrendingUp}
            cor="from-emerald-500 to-green-700"
            titulo="Valor executado"
            valor={brl(saldo?.valorUsado ?? 0)}
            sub={saldo ? `${saldo.percentualUsado.toFixed(1)}% do total` : "Sem execução registrada"}
          />
          <KpiBlock
            icone={Truck}
            cor="from-blue-500 to-indigo-700"
            titulo="Valor a executar"
            valor={brl(saldo?.valorDisponivel ?? valorContratado)}
            sub="Saldo disponível"
          />
        </div>
      </section>

      {/* Execução física + tempo */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Execução física &amp; tempo decorrido
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Bloco
            titulo="Empenhos vinculados"
            valor={`${qtdEmpenhos}`}
            sub={`${empenhosPagos} pagos · ${qtdEmpenhos - empenhosPagos} em execução`}
          >
            <BarraProgresso pct={qtdEmpenhos > 0 ? (empenhosPagos / qtdEmpenhos) * 100 : 0} cor="emerald" />
          </Bloco>

          <Bloco
            titulo="Vigência decorrida"
            valor={`${pctTempoDecorrido.toFixed(0)}%`}
            sub={
              diasAteVencer < 0
                ? `Vencido há ${Math.abs(diasAteVencer)} dia(s)`
                : `${diasAteVencer} dia(s) até vencer`
            }
          >
            <BarraProgresso pct={pctTempoDecorrido} cor={diasAteVencer < 30 ? "amber" : "blue"} />
          </Bloco>
        </div>
      </section>

      {/* Marcos contratuais */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Marcos &amp; prazos
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Marco
            icone={FileSignature}
            titulo={rotuloRecurso === "Contrato" ? "Assinatura" : "Emissão"}
            data={contrato.dataAssinatura ?? contrato.dataEmissao}
          />
          <Marco
            icone={Clock}
            titulo="Vigência"
            data={null}
            extra={`${contrato.vigenciaInicio.toLocaleDateString("pt-BR")} → ${contrato.vigenciaFim.toLocaleDateString("pt-BR")}`}
          />
          <Marco
            icone={Truck}
            titulo="Prazo de entrega"
            data={null}
            extra={contrato.prazoEntregaDias ? `${contrato.prazoEntregaDias} dias contratuais` : "Não informado"}
          />
          <Marco
            icone={Wallet}
            titulo="Prazo de pagamento"
            data={null}
            extra={contrato.prazoPagamentoDias ? `${contrato.prazoPagamentoDias} dias após NF` : "Não informado"}
          />
        </div>

        {janelaReajuste && diasParaReajuste !== null && (
          <div
            className={`mt-3 flex items-start gap-3 rounded-lg border p-3 ${
              diasParaReajuste <= 0
                ? "border-amber-300 bg-amber-50"
                : diasParaReajuste <= 60
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <AlertTriangle
              className={`mt-0.5 h-4 w-4 shrink-0 ${diasParaReajuste <= 60 ? "text-amber-700" : "text-slate-500"}`}
            />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-slate-900">Janela de reajuste de preços</p>
              <p className="mt-0.5 text-slate-700">
                Marco do orçamento estimado:{" "}
                <strong>{contrato.marcoOrcamentoEstimado!.toLocaleDateString("pt-BR")}</strong>.
                Janela de reajuste em <strong>{janelaReajuste.toLocaleDateString("pt-BR")}</strong> ·{" "}
                {diasParaReajuste <= 0
                  ? `Reajuste já cabível há ${Math.abs(diasParaReajuste)} dia(s).`
                  : `Faltam ${diasParaReajuste} dia(s).`}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Movimentos contratuais */}
      <section>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
          Movimentos contratuais
        </h3>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <Stat rotulo="Termos aditivos" valor={qtdAditivos} sub={`${aditivosValor} de valor · ${aditivosPrazo} de prazo`} />
          <Stat rotulo="Apostilamentos" valor={qtdApostilamentos} />
          <Stat rotulo="Reajustes aplicados" valor={qtdReajustes} />
          <Stat rotulo="Notificações do órgão" valor={qtdNotificacoes} />
          <Stat rotulo="Procedimentos apuratórios" valor={qtdProcedimentos} />
        </div>
      </section>

      <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
        Este relatório é gerado em tempo real a partir dos dados cadastrados.
        Para análise jurídica do contrato (resumo executivo, pontos críticos, checklist de
        compliance) use o botão <strong>&ldquo;Análise jurídica IA&rdquo;</strong> no topo da página.
      </p>
    </div>
  );
}

function KpiBlock({ icone: Icone, cor, titulo, valor, sub }: { icone: React.ComponentType<{ className?: string }>; cor: string; titulo: string; valor: string; sub: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cor} p-4 text-white shadow-sm`}>
      <Icone className="h-5 w-5 text-white/70" />
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/80">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{valor}</p>
      <p className="mt-1 text-xs text-white/80">{sub}</p>
    </div>
  );
}

function Bloco({ titulo, valor, sub, children }: { titulo: string; valor: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function BarraProgresso({ pct, cor }: { pct: number; cor: "emerald" | "blue" | "amber" }) {
  const c = cor === "emerald" ? "bg-emerald-600" : cor === "blue" ? "bg-blue-600" : "bg-amber-600";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full ${c}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Marco({ icone: Icone, titulo, data, extra }: { icone: React.ComponentType<{ className?: string }>; titulo: string; data?: Date | null; extra?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100">
        <Icone className="h-4 w-4 text-slate-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{titulo}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">
          {data ? data.toLocaleDateString("pt-BR") : extra || "—"}
        </p>
      </div>
    </div>
  );
}

function Stat({ rotulo, valor, sub }: { rotulo: string; valor: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{valor}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}
