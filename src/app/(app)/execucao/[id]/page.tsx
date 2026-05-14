import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Receipt, AlertTriangle, Pencil } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl, formatarCnpj, ROTULO_PROCEDIMENTO, ROTULO_TIPO } from "@/lib/validators";
import { podeEditarDocumento } from "@/lib/permissoes";
import { AvancarStatus } from "@/components/AvancarStatus";
import { Tabs } from "@/components/Tabs";
import { TimelineExecucao } from "@/components/TimelineExecucao";
import { RelatorioContratacao } from "@/components/RelatorioContratacao";
import { AlertaReajuste } from "@/components/AlertaReajuste";
import { AditivosTab } from "@/components/abas/AditivosTab";
import { ApostilamentosTab } from "@/components/abas/ApostilamentosTab";
import { ReajustesTab } from "@/components/abas/ReajustesTab";
import { GarantiasTab } from "@/components/abas/GarantiasTab";
import { NotificacoesTab } from "@/components/abas/NotificacoesTab";
import { ProcedimentosTab } from "@/components/abas/ProcedimentosTab";
import { AnexosTab, AnotacoesTab } from "@/components/abas/AnexosTab";
import { EnderecosPontosFocaisTab } from "@/components/abas/OrgaosTab";
import { HistoricoLista } from "@/components/abas/HistoricoLista";
import { ItensEmpenhoTab } from "@/components/abas/ItensEmpenhoTab";
import { ComissoesNoEmpenhoTab } from "@/components/abas/ComissoesNoEmpenhoTab";
import { labelInstrumento } from "@/lib/instrumentoLabel";

const PASSOS = [
  { marco: "PEDIDO_RECEBIDO", label: "Pedido recebido", campo: "dataPedidoRecebido" },
  { marco: "EM_TRANSITO", label: "Em trânsito/Em execução", campo: "dataDespacho" },
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
      criadoPor: { select: { nome: true, email: true } },
      comissoes: {
        include: {
          analista: { select: { nomeCompleto: true, email: true } },
        },
        orderBy: { criadoEm: "asc" },
      },
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

  const podeEditar = podeEditarDocumento(usuario, e);
  const itemIds = e.itens.map((i) => i.id);
  const enderecoIds = e.enderecosEntrega.map((x) => x.id);
  const pontoFocalIds = e.pontosFocais.map((p) => p.id);
  const historico = await prisma.logAuditoria.findMany({
    where: {
      contaId: usuario.contaId,
      OR: [
        { recurso: "Empenho", recursoId: e.id },
        { recurso: "EmpenhoItem", recursoId: { in: itemIds.length > 0 ? itemIds : ["__none__"] } },
        { recurso: "EnderecoEntrega", recursoId: { in: enderecoIds.length > 0 ? enderecoIds : ["__none__"] } },
        { recurso: "PontoFocal", recursoId: { in: pontoFocalIds.length > 0 ? pontoFocalIds : ["__none__"] } },
      ],
    },
    orderBy: { criadoEm: "desc" },
    take: 200,
    include: { usuario: { select: { nome: true, email: true } } },
  });

  // Empenho não tem marcoOrcamentoEstimado próprio — herda do Contrato (ou Ata) pai
  const marcoReajusteHerdado = e.contrato?.marcoOrcamentoEstimado ?? e.ata?.marcoOrcamentoEstimado ?? null;

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
          <h1 className="text-3xl font-bold text-slate-900">{labelInstrumento(e.instrumento)} {e.numero}</h1>
          <p className="mt-1 text-sm text-slate-600">{e.objeto}</p>
          <p className="mt-2 text-xs text-slate-500">
            {e.empresa.nomeFantasia || e.empresa.razaoSocial} · {e.orgaoNome}
            {e.contrato && (
              <> · derivado do <Link href={`/contratos/${e.contrato.id}`} className="text-emerald-700 hover:underline">Contrato {e.contrato.numero}</Link></>
            )}
            {e.ata && !e.contrato && (
              <> · derivado da <Link href={`/atas/${e.ata.id}`} className="text-blue-700 hover:underline">Ata {e.ata.numero}</Link></>
            )}
            {e.criadoPor && (
              <> · criado por <strong>{e.criadoPor.nome}</strong></>
            )}
          </p>
        </div>
        {e.status !== "PAGO" && podeEditar && (
          <Link
            href={`/execucao/${e.id}/editar`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title={`Editar dados da ${labelInstrumento(e.instrumento).toLowerCase()}`}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Link>
        )}
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

      <AlertaReajuste marcoOrcamentoEstimado={marcoReajusteHerdado} hrefReajustes="/reajustes" />

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
          <TimelineExecucao
            status={e.status}
            comDatas
            marcos={{
              EMPENHADO: e.dataEmissao,
              PEDIDO_RECEBIDO: e.dataPedidoRecebido,
              EM_TRANSITO: e.dataDespacho,
              ENTREGUE: e.dataEntrega,
              NF_EMITIDA: e.dataNfEmitida,
              NF_ENCAMINHADA: e.dataNfEncaminhada,
              PAGO: e.dataPagamento,
            }}
          />
        </div>
      </div>

      <div className="mt-8">
        <Tabs
          abas={[
            {
              key: "execucao",
              label: "Execução / Linha do tempo",
              content: (
                <Timeline
                  empenho={{
                    id: e.id,
                    prazoEntregaDias: e.prazoEntregaDias,
                    prazoEntregaUnidade: e.prazoEntregaUnidade,
                    prazoEntregaModo: e.prazoEntregaModo,
                    dataEntregaCerta: e.dataEntregaCerta,
                    prazoPagamentoDias: e.prazoPagamentoDias,
                    dataPedidoRecebido: e.dataPedidoRecebido,
                    arquivoPedidoRecebido: e.arquivoPedidoRecebido,
                    dataDespacho: e.dataDespacho,
                    arquivoDespacho: e.arquivoDespacho,
                    dataEntrega: e.dataEntrega,
                    arquivoEntrega: e.arquivoEntrega,
                    dataNfEmitida: e.dataNfEmitida,
                    arquivoNfEmitida: e.arquivoNfEmitida,
                    dataNfEncaminhada: e.dataNfEncaminhada,
                    arquivoNfEncaminhada: e.arquivoNfEncaminhada,
                    dataPagamento: e.dataPagamento,
                    arquivoPagamento: e.arquivoPagamento,
                  }}
                />
              ),
            },
            {
              key: "itens",
              label: "Itens",
              content: <ItensEmpenhoTab itens={e.itens} empenhoEditavel={e.status !== "PAGO"} />,
            },
            {
              key: "comissoes",
              label: "Comissões dos analistas",
              badge: e.comissoes.length,
              content: <ComissoesNoEmpenhoTab comissoes={e.comissoes} />,
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
              content: (
                <GarantiasTab
                  garantias={e.garantias}
                  empenhoId={e.id}
                  temGarantia={e.temGarantia}
                />
              ),
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
            {
              key: "historico",
              label: "Histórico",
              badge: historico.length,
              content: <HistoricoLista entradas={historico} />,
            },
            {
              key: "relatorio",
              label: "Relatório",
              content: (
                <RelatorioContratacao
                  rotuloRecurso="Empenho"
                  contrato={{
                    numero: e.numero,
                    vigenciaInicio: e.vigenciaInicio,
                    vigenciaFim: e.vigenciaFim,
                    dataEmissao: e.dataEmissao,
                    prazoEntregaDias: e.prazoEntregaDias,
                    prazoPagamentoDias: e.prazoPagamentoDias,
                    marcoOrcamentoEstimado: marcoReajusteHerdado,
                    itens: e.itens.map((i) => ({ quantidade: i.quantidade, valorTotal: i.valorTotal })),
                  }}
                  qtdEmpenhos={1}
                  empenhosPagos={e.status === "PAGO" ? 1 : 0}
                  qtdAditivos={e.termosAditivos.length}
                  aditivos={e.termosAditivos.map((a) => ({
                    alteraValor: a.alteraValor,
                    novoValor: a.novoValor,
                    alteraPrazoVigencia: a.alteraPrazoVigencia,
                    novaVigenciaFim: a.novaVigenciaFim,
                  }))}
                  qtdApostilamentos={e.apostilamentos.length}
                  qtdReajustes={e.reajustes.length}
                  qtdNotificacoes={e.notificacoes.length}
                  qtdProcedimentos={e.procedimentos.length}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

const CAMPO_ARQUIVO_ETAPA: Record<string, string> = {
  PEDIDO_RECEBIDO: "arquivoPedidoRecebido",
  EM_TRANSITO:     "arquivoDespacho",
  ENTREGUE:        "arquivoEntrega",
  NF_EMITIDA:      "arquivoNfEmitida",
  NF_ENCAMINHADA:  "arquivoNfEncaminhada",
  PAGO:            "arquivoPagamento",
};

function Timeline({
  empenho,
}: {
  empenho: {
    id: string;
    prazoEntregaDias: number | null;
    prazoEntregaUnidade?: "DIAS" | "MESES";
    prazoEntregaModo?: "RELATIVO" | "DATA_CERTA";
    dataEntregaCerta?: Date | null;
    prazoPagamentoDias: number | null;
    dataPedidoRecebido: Date | null;
    arquivoPedidoRecebido: string | null;
    dataDespacho: Date | null;
    arquivoDespacho: string | null;
    dataEntrega: Date | null;
    arquivoEntrega: string | null;
    dataNfEmitida: Date | null;
    arquivoNfEmitida: string | null;
    dataNfEncaminhada: Date | null;
    arquivoNfEncaminhada: string | null;
    dataPagamento: Date | null;
    arquivoPagamento: string | null;
  };
}) {
  // Prazo-limite — duas formas:
  //  - DATA_CERTA: a data já é o limite tempestivo (vale pra Locação,
  //    eventos com data fixa, etc.). Não depende de pedido recebido.
  //  - RELATIVO: contado a partir do recebimento do pedido. Multiplica
  //    pela unidade (DIAS direto, MESES = 30 dias por mês).
  const prazoLimiteEntrega: Date | null = (() => {
    if (empenho.prazoEntregaModo === "DATA_CERTA") {
      return empenho.dataEntregaCerta ?? null;
    }
    if (!empenho.dataPedidoRecebido || !empenho.prazoEntregaDias) return null;
    const fatorDias =
      empenho.prazoEntregaUnidade === "MESES" ? 30 : 1;
    return new Date(
      empenho.dataPedidoRecebido.getTime() +
        empenho.prazoEntregaDias * fatorDias * 86400000,
    );
  })();

  // Prazo-limite de pagamento (30 dias após NF encaminhada, ou prazoPagamentoDias se definido)
  const diasPgto = empenho.prazoPagamentoDias ?? 30;
  const prazoLimitePagamento =
    empenho.dataNfEncaminhada
      ? new Date(empenho.dataNfEncaminhada.getTime() + diasPgto * 86400000)
      : null;

  const entregaAtrasada =
    prazoLimiteEntrega &&
    !empenho.dataEntrega &&
    Date.now() > prazoLimiteEntrega.getTime();

  const pagamentoAtrasado =
    prazoLimitePagamento &&
    !empenho.dataPagamento &&
    Date.now() > prazoLimitePagamento.getTime();

  const entregaComAtraso =
    empenho.dataEntrega &&
    prazoLimiteEntrega &&
    empenho.dataEntrega > prazoLimiteEntrega;

  return (
    <div className="space-y-3">
      {/* Alertas ativos */}
      {entregaAtrasada && (
        <Alerta cor="red">
          Entrega em atraso — o prazo de {empenho.prazoEntregaDias} dias venceu em{" "}
          {prazoLimiteEntrega!.toLocaleDateString("pt-BR")}.
        </Alerta>
      )}
      {pagamentoAtrasado && (
        <Alerta cor="red">
          Pagamento em atraso pelo órgão — prazo de {diasPgto} dias encerrou em{" "}
          {prazoLimitePagamento!.toLocaleDateString("pt-BR")}.
        </Alerta>
      )}

      <ol className="space-y-2">
        {PASSOS.map((p, idx) => {
          const data = empenho[p.campo as keyof typeof empenho] as Date | null;
          const arquivo = empenho[CAMPO_ARQUIVO_ETAPA[p.marco] as keyof typeof empenho] as string | null;
          const concluido = !!data;
          const anterior = idx === 0 ? true : !!empenho[PASSOS[idx - 1].campo as keyof typeof empenho];
          const podeFazer = !concluido && anterior;

          // Alerta de entrega com atraso
          const isEntrega = p.marco === "ENTREGUE";
          const isPago = p.marco === "PAGO";

          return (
            <>
              <li
                key={p.marco}
                className={`rounded-xl border p-4 transition ${
                  concluido
                    ? "border-emerald-200 bg-emerald-50/40"
                    : podeFazer
                      ? "border-blue-200 bg-blue-50/20"
                      : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Indicador */}
                  <div
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      concluido
                        ? "bg-emerald-600 text-white"
                        : podeFazer
                          ? "bg-blue-600 text-white"
                          : "border border-slate-300 bg-white text-slate-400"
                    }`}
                  >
                    {concluido ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                        <path d="M16 5.5a7 7 0 1 0 0 13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                        <path d="M14 5.5v13" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                        <path d="M14 9.2h2.5a2.4 2.4 0 0 1 0 4.8H14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${concluido ? "text-slate-800" : podeFazer ? "text-slate-900" : "text-slate-400"}`}>
                        {p.label}
                      </span>
                      {isEntrega && entregaComAtraso && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          ⚠ Entregue com atraso
                        </span>
                      )}
                      {isPago && prazoLimitePagamento && concluido && empenho.dataPagamento! > prazoLimitePagamento && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          ⚠ Pago com atraso pelo órgão
                        </span>
                      )}
                    </div>

                    <div className="mt-2">
                      <AvancarStatus
                        empenhoId={empenho.id}
                        marco={p.marco}
                        ja={data}
                        jaArquivo={arquivo}
                        bloqueado={!concluido && !anterior}
                      />
                    </div>
                  </div>
                </div>
              </li>

              {/* Marcador do prazo-limite de entrega — aparece após "Pedido recebido" */}
              {p.marco === "PEDIDO_RECEBIDO" && prazoLimiteEntrega && (
                <li
                  key="prazo-limite"
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
                    entregaAtrasada
                      ? "border-red-200 bg-red-50"
                      : empenho.dataEntrega && entregaComAtraso
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="h-5 w-5 shrink-0 rounded-full border-2 border-amber-400 bg-amber-400" />
                  <div>
                    <p className={`text-xs font-semibold ${entregaAtrasada || entregaComAtraso ? "text-red-800" : "text-amber-800"}`}>
                      Prazo-limite de entrega/execução tempestiva
                    </p>
                    <p className={`text-xs ${entregaAtrasada || entregaComAtraso ? "text-red-700" : "text-amber-700"}`}>
                      {prazoLimiteEntrega.toLocaleDateString("pt-BR")}{" "}
                      {empenho.prazoEntregaModo === "DATA_CERTA"
                        ? "(data certa cadastrada)"
                        : `(${empenho.prazoEntregaDias} ${empenho.prazoEntregaUnidade === "MESES" ? "meses" : "dias"} após recebimento do pedido)`}
                      {entregaAtrasada && " — vencido"}
                      {entregaComAtraso && " — entregue com atraso"}
                    </p>
                  </div>
                </li>
              )}
            </>
          );
        })}
      </ol>

      {/* Info prazo de pagamento */}
      {prazoLimitePagamento && !empenho.dataPagamento && (
        <div className={`rounded-lg border px-4 py-2.5 ${pagamentoAtrasado ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
          <p className={`text-xs font-medium ${pagamentoAtrasado ? "text-red-800" : "text-slate-600"}`}>
            Prazo de pagamento pelo órgão: {prazoLimitePagamento.toLocaleDateString("pt-BR")} ({diasPgto} dias após NF encaminhada)
            {pagamentoAtrasado && " — vencido"}
          </p>
        </div>
      )}
    </div>
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
    instrumento: string;
    tipo: string; procedimentoSelecao: string | null; processoAdministrativo: string;
    numeroLicitacao: string | null; orgaoNome: string; orgaoCnpj: string;
    dataEmissao: Date; vigenciaInicio: Date; vigenciaFim: Date;
    prazoEntregaDias: number | null;
    prazoEntregaUnidade: "DIAS" | "MESES";
    prazoEntregaModo: "RELATIVO" | "DATA_CERTA";
    dataEntregaCerta: Date | null;
    prazoPagamentoDias: number | null;
    classificacaoOrcamentaria: string | null;
    signatario: string | null;
    dataAssinatura: Date | null;
    departamentoEmissor: string | null;
    pontoColeta: string | null;
    contatoRecebedor: string | null;
    fiscalResponsavel: string | null;
  };
}) {
  return (
    <div className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
      <Info label="Instrumento" valor={labelInstrumento(e.instrumento as never)} />
      <Info label="Tipo" valor={ROTULO_TIPO[e.tipo as keyof typeof ROTULO_TIPO]} />
      {/* M3.3 ajuste 2 — Procedimento de seleção só aparece se houver
          (legacy). Novos cadastros não preenchem mais esse campo. */}
      {e.procedimentoSelecao && (
        <Info label="Procedimento" valor={ROTULO_PROCEDIMENTO[e.procedimentoSelecao as keyof typeof ROTULO_PROCEDIMENTO]} />
      )}
      <Info label="Processo administrativo" valor={e.processoAdministrativo} />
      <Info label="Nº Licitação" valor={e.numeroLicitacao || "—"} />
      <Info label="Órgão" valor={`${e.orgaoNome} (${formatarCnpj(e.orgaoCnpj)})`} />
      {/* M3.3 ajuste 3 — "Data de recebimento do documento" (era "Data
          de emissão"). Campo no banco continua `dataEmissao`. */}
      <Info label="Data de recebimento do documento" valor={e.dataEmissao.toLocaleDateString("pt-BR")} />
      <Info label="Vigência" valor={`${e.vigenciaInicio.toLocaleDateString("pt-BR")} → ${e.vigenciaFim.toLocaleDateString("pt-BR")}`} />
      <Info
        label="Prazo de entrega"
        valor={
          e.prazoEntregaModo === "DATA_CERTA"
            ? e.dataEntregaCerta
              ? `Data certa: ${e.dataEntregaCerta.toLocaleDateString("pt-BR")}`
              : "Data certa não informada"
            : e.prazoEntregaDias
              ? `${e.prazoEntregaDias} ${e.prazoEntregaUnidade === "MESES" ? (e.prazoEntregaDias === 1 ? "mês" : "meses") : "dias"}`
              : "—"
        }
      />
      <Info label="Prazo de pagamento" valor={e.prazoPagamentoDias ? `${e.prazoPagamentoDias} dias` : "—"} />
      {e.classificacaoOrcamentaria && (
        <Info label="Classificação orçamentária" valor={e.classificacaoOrcamentaria} />
      )}
      {e.signatario && <Info label="Signatário" valor={e.signatario} />}
      {e.dataAssinatura && (
        <Info label="Data de assinatura" valor={e.dataAssinatura.toLocaleDateString("pt-BR")} />
      )}
      {e.departamentoEmissor && (
        <Info label="Departamento emissor" valor={e.departamentoEmissor} />
      )}
      {e.pontoColeta && <Info label="Ponto de coleta/entrega" valor={e.pontoColeta} />}
      {e.contatoRecebedor && <Info label="Contato do recebedor" valor={e.contatoRecebedor} />}
      {e.fiscalResponsavel && <Info label="Fiscal responsável" valor={e.fiscalResponsavel} />}
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
