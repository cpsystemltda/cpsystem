import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Receipt, AlertTriangle } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, formatarCnpj, ROTULO_PROCEDIMENTO, ROTULO_TIPO } from "@/lib/validators";
import { AvancarStatus } from "@/components/AvancarStatus";
import { Tabs } from "@/components/Tabs";
import { TimelineExecucao } from "@/components/TimelineExecucao";
import { AditivosTab } from "@/components/abas/AditivosTab";
import { ApostilamentosTab } from "@/components/abas/ApostilamentosTab";
import { ReajustesTab } from "@/components/abas/ReajustesTab";
import { GarantiasTab } from "@/components/abas/GarantiasTab";
import { NotificacoesTab } from "@/components/abas/NotificacoesTab";
import { ProcedimentosTab } from "@/components/abas/ProcedimentosTab";
import { AnexosTab, AnotacoesTab } from "@/components/abas/AnexosTab";
import { EnderecosPontosFocaisTab } from "@/components/abas/OrgaosTab";

const PASSOS = [
  { marco: "PEDIDO_RECEBIDO", label: "Pedido recebido", campo: "dataPedidoRecebido" },
  { marco: "EM_TRANSITO", label: "Despachado / em trânsito", campo: "dataDespacho" },
  { marco: "ENTREGUE", label: "Entregue", campo: "dataEntrega" },
  { marco: "NF_EMITIDA", label: "Nota Fiscal emitida", campo: "dataNfEmitida" },
  { marco: "NF_ENCAMINHADA", label: "Nota Fiscal encaminhada", campo: "dataNfEncaminhada" },
  { marco: "PAGO", label: "Pago", campo: "dataPagamento" },
] as const;

export default async function EmpenhoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const e = await prisma.empenho.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      empresa: true,
      ata: true,
      contrato: true,
      itens: true,
      enderecosEntrega: true,
      pontosFocais: true,
      termosAditivos: { orderBy: { dataAssinatura: "desc" } },
      apostilamentos: { orderBy: { dataAssinatura: "desc" } },
      reajustes: { orderBy: { dataPedido: "desc" } },
      notificacoes: { include: { andamentos: { orderBy: { dataEvento: "asc" } } }, orderBy: { criadoEm: "desc" } },
      procedimentos: {
        include: {
          andamentos: { orderBy: { dataEvento: "asc" } },
          penalidades: { orderBy: { dataAplicacao: "asc" } },
        },
        orderBy: { criadoEm: "desc" },
      },
      garantias: { include: { endossos: { orderBy: { dataInicio: "asc" } } }, orderBy: { criadoEm: "desc" } },
      anexos: { orderBy: { criadoEm: "desc" } },
      anotacoes: { orderBy: { criadoEm: "desc" } },
    },
  });

  if (!e) notFound();

  const valorTotal = e.itens.reduce((s, i) => s + i.valorTotal, 0);
  const prazoEntrega =
    e.dataPedidoRecebido && e.prazoEntregaDias
      ? new Date(e.dataPedidoRecebido.getTime() + e.prazoEntregaDias * 86400000)
      : null;
  const prazoPagamento =
    e.dataNfEncaminhada && e.prazoPagamentoDias
      ? new Date(e.dataNfEncaminhada.getTime() + e.prazoPagamentoDias * 86400000)
      : null;

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <Link href="/execucao" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-50">
          <Receipt className="h-6 w-6 text-amber-700" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">Empenho {e.numero}</h1>
          <p className="mt-1 text-sm text-slate-600">{e.objeto}</p>
          <p className="mt-2 text-xs text-slate-500">
            {e.empresa.nomeFantasia || e.empresa.razaoSocial} · {e.orgaoNome}
            {e.contrato && (
              <> · derivado do <Link href={`/contratos/${e.contrato.id}`} className="text-emerald-700 hover:underline">Contrato {e.contrato.numero}</Link></>
            )}
            {e.ata && !e.contrato && (
              <> · derivado da <Link href={`/atas/${e.ata.id}`} className="text-blue-700 hover:underline">Ata {e.ata.numero}</Link></>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {prazoEntrega && !e.dataEntrega && Date.now() > prazoEntrega.getTime() && (
          <Alerta cor="red">Entrega atrasada — prazo era {prazoEntrega.toLocaleDateString("pt-BR")}.</Alerta>
        )}
        {prazoPagamento && !e.dataPagamento && Date.now() > prazoPagamento.getTime() && (
          <Alerta cor="red">
            Pagamento em atraso pelo órgão — prazo era {prazoPagamento.toLocaleDateString("pt-BR")} ({e.prazoPagamentoDias} dias após NF).
          </Alerta>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat titulo="Valor empenhado" valor={brl(valorTotal)} />
        <Stat titulo="Status" valor={e.status.replace(/_/g, " ")} />
        <Stat
          titulo="Próximo marco"
          valor={(() => {
            const next = PASSOS.find((p) => !e[p.campo as keyof typeof e]);
            return next ? next.label.split(" ")[0] : "Concluído";
          })()}
        />
      </div>

      {/* Timeline horizontal premium estilo "rastreamento de pedido" */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Rastreamento da execução
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              Acompanhe a entrega e o pagamento etapa por etapa.
            </p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-800">
            {e.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="mt-5">
          <TimelineExecucao status={e.status} />
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[9px] font-medium text-slate-500">
          <span>Empenhado</span>
          <span>Pedido</span>
          <span>Trânsito</span>
          <span>Entregue</span>
          <span>NF emitida</span>
          <span>NF enviada</span>
          <span>Pago</span>
        </div>
      </div>

      <div className="mt-8">
        <Tabs
          abas={[
            {
              key: "execucao",
              label: "Execução / Linha do tempo",
              content: <Timeline empenho={e} />,
            },
            {
              key: "itens",
              label: "Itens",
              content: <TabelaItens itens={e.itens} />,
            },
            {
              key: "aditivos",
              label: "Aditivos",
              badge: e.termosAditivos.length,
              content: <AditivosTab aditivos={e.termosAditivos} empenhoId={e.id} />,
            },
            {
              key: "apostilamentos",
              label: "Apostilamentos",
              badge: e.apostilamentos.length,
              content: <ApostilamentosTab apostilamentos={e.apostilamentos} empenhoId={e.id} />,
            },
            {
              key: "reajustes",
              label: "Reajustes",
              badge: e.reajustes.length,
              content: <ReajustesTab reajustes={e.reajustes} empenhoId={e.id} />,
            },
            {
              key: "garantias",
              label: "Garantias",
              badge: e.garantias.length,
              content: <GarantiasTab garantias={e.garantias} empenhoId={e.id} />,
            },
            {
              key: "enderecos",
              label: "Endereços / Pontos focais",
              badge: e.enderecosEntrega.length + e.pontosFocais.length,
              content: (
                <EnderecosPontosFocaisTab
                  enderecos={e.enderecosEntrega}
                  pontosFocais={e.pontosFocais}
                  empenhoId={e.id}
                />
              ),
            },
            {
              key: "notificacoes",
              label: "Notificações",
              badge: e.notificacoes.length,
              content: <NotificacoesTab notificacoes={e.notificacoes} empenhoId={e.id} />,
            },
            {
              key: "procedimentos",
              label: "Procedimentos",
              badge: e.procedimentos.length,
              content: <ProcedimentosTab procedimentos={e.procedimentos} empenhoId={e.id} />,
            },
            {
              key: "anexos",
              label: "Anexos",
              badge: e.anexos.length,
              content: <AnexosTab anexos={e.anexos} empenhoId={e.id} />,
            },
            {
              key: "anotacoes",
              label: "Anotações",
              badge: e.anotacoes.length,
              content: <AnotacoesTab anotacoes={e.anotacoes} empenhoId={e.id} />,
            },
            {
              key: "dados",
              label: "Dados",
              content: <DadosEmpenho e={e} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

function Timeline({
  empenho,
}: {
  empenho: {
    id: string;
    dataPedidoRecebido: Date | null;
    dataDespacho: Date | null;
    dataEntrega: Date | null;
    dataNfEmitida: Date | null;
    dataNfEncaminhada: Date | null;
    dataPagamento: Date | null;
  };
}) {
  return (
    <ol className="space-y-3">
      {PASSOS.map((p, idx) => {
        const data = empenho[p.campo as keyof typeof empenho] as Date | null;
        const concluido = !!data;
        const anterior = idx === 0 ? true : !!empenho[PASSOS[idx - 1].campo as keyof typeof empenho];
        const podeFazer = !concluido && anterior;

        return (
          <li
            key={p.marco}
            className={`flex items-center gap-4 rounded-lg border p-4 ${
              concluido ? "border-emerald-200 bg-emerald-50/40" : podeFazer ? "border-blue-200 bg-blue-50/30" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div
              className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                concluido ? "bg-emerald-600 text-white" : podeFazer ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-600"
              }`}
            >
              {idx + 1}
            </div>
            <div className="flex-1 text-sm">{p.label}</div>
            <div>
              {concluido ? (
                <AvancarStatus empenhoId={empenho.id} marco={p.marco} ja={data} />
              ) : podeFazer ? (
                <AvancarStatus empenhoId={empenho.id} marco={p.marco} />
              ) : (
                <span className="text-xs text-slate-400">Aguardando etapa anterior</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TabelaItens({
  itens,
}: {
  itens: { id: string; descricao: string; unidade: string; quantidade: number; valorUnitario: number; valorTotal: number; moeda: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Descrição</th>
            <th className="px-4 py-2 text-left">Un.</th>
            <th className="px-4 py-2 text-right">Qtd.</th>
            <th className="px-4 py-2 text-left">Moeda</th>
            <th className="px-4 py-2 text-right">Valor unit.</th>
            <th className="px-4 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((it) => (
            <tr key={it.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{it.descricao}</td>
              <td className="px-4 py-2 text-slate-600">{it.unidade}</td>
              <td className="px-4 py-2 text-right">{it.quantidade}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{it.moeda}</td>
              <td className="px-4 py-2 text-right text-slate-600">{brl(it.valorUnitario)}</td>
              <td className="px-4 py-2 text-right font-medium">{brl(it.valorTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DadosEmpenho({
  e,
}: {
  e: {
    tipo: string; procedimentoSelecao: string; processoAdministrativo: string;
    numeroLicitacao: string | null; orgaoNome: string; orgaoCnpj: string;
    dataEmissao: Date; vigenciaInicio: Date; vigenciaFim: Date;
    prazoEntregaDias: number | null; prazoPagamentoDias: number | null;
  };
}) {
  return (
    <div className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
      <Info label="Tipo" valor={ROTULO_TIPO[e.tipo as keyof typeof ROTULO_TIPO]} />
      <Info label="Procedimento" valor={ROTULO_PROCEDIMENTO[e.procedimentoSelecao as keyof typeof ROTULO_PROCEDIMENTO]} />
      <Info label="Processo administrativo" valor={e.processoAdministrativo} />
      <Info label="Nº Licitação" valor={e.numeroLicitacao || "—"} />
      <Info label="Órgão" valor={`${e.orgaoNome} (${formatarCnpj(e.orgaoCnpj)})`} />
      <Info label="Data de emissão" valor={e.dataEmissao.toLocaleDateString("pt-BR")} />
      <Info label="Vigência" valor={`${e.vigenciaInicio.toLocaleDateString("pt-BR")} → ${e.vigenciaFim.toLocaleDateString("pt-BR")}`} />
      <Info label="Prazo de entrega" valor={e.prazoEntregaDias ? `${e.prazoEntregaDias} dias` : "—"} />
      <Info label="Prazo de pagamento" valor={e.prazoPagamentoDias ? `${e.prazoPagamentoDias} dias` : "—"} />
    </div>
  );
}

function Stat({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{valor}</p>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{valor}</dd>
    </div>
  );
}

function Alerta({ cor, children }: { cor: "amber" | "red"; children: React.ReactNode }) {
  const cls = cor === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${cls}`}>
      <AlertTriangle className="h-4 w-4" />
      {children}
    </div>
  );
}
