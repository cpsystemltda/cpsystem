import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ClipboardList, Receipt, Pencil } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoContrato } from "@/lib/saldo";
import { podeEditarDocumento } from "@/lib/permissoes";
import {
  brl,
  formatarCnpj,
  ROTULO_PROCEDIMENTO,
  ROTULO_TIPO,
  ROTULO_MODALIDADE_ENTREGA,
  ROTULO_MARCO_INICIAL,
  isContratoNaoContinuado,
} from "@/lib/validators";
import { Tabs } from "@/components/Tabs";
import { TimelineExecucao } from "@/components/TimelineExecucao";
import { AnaliseJuridicaIA } from "@/components/AnaliseJuridicaIA";
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
import { SaldoVigenciasPanel } from "@/components/SaldoVigenciasPanel";
import { KpisSaldoVigencia } from "@/components/KpisSaldoVigencia";
import { BotaoExcluirContrato } from "@/components/BotaoExcluirContrato";
import { labelInstrumento } from "@/lib/instrumentoLabel";
import type { InstrumentoContratual } from "@/generated/prisma/client";

export default async function ContratoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const contrato = await prisma.contrato.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      empresa: true,
      criadoPor: { select: { nome: true, email: true } },
      itens: { select: { quantidade: true, valorTotal: true } },
      ata: true,
      empenhos: { orderBy: { criadoEm: "desc" } },
      parcelas: { orderBy: { numero: "asc" } },
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

  if (!contrato) notFound();

  const podeEditar = podeEditarDocumento(usuario, contrato);
  const saldo = await calcularSaldoContrato(contrato.id);

  const itemIds = (
    await prisma.contratoItem.findMany({ where: { contratoId: contrato.id }, select: { id: true } })
  ).map((i) => i.id);
  const parcelaIds = contrato.parcelas.map((p) => p.id);
  const enderecoIds = contrato.enderecosEntrega.map((e) => e.id);
  const pontoFocalIds = contrato.pontosFocais.map((p) => p.id);

  const historico = await prisma.logAuditoria.findMany({
    where: {
      contaId: usuario.contaId,
      OR: [
        { recurso: "Contrato", recursoId: contrato.id },
        { recurso: "ContratoItem", recursoId: { in: itemIds.length > 0 ? itemIds : ["__none__"] } },
        { recurso: "ParcelaContrato", recursoId: { in: parcelaIds.length > 0 ? parcelaIds : ["__none__"] } },
        { recurso: "EnderecoEntrega", recursoId: { in: enderecoIds.length > 0 ? enderecoIds : ["__none__"] } },
        { recurso: "PontoFocal", recursoId: { in: pontoFocalIds.length > 0 ? pontoFocalIds : ["__none__"] } },
      ],
    },
    orderBy: { criadoEm: "desc" },
    take: 200,
    include: { usuario: { select: { nome: true, email: true } } },
  });

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <Link href="/contratos" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar para Contratos
      </Link>

      <div className="mt-4 flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-50">
          <ClipboardList className="h-6 w-6 text-emerald-700" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">Contrato {contrato.numero}</h1>
          <p className="mt-1 text-sm text-slate-600">{contrato.objeto}</p>
          <p className="mt-2 text-xs text-slate-500">
            {contrato.empresa.nomeFantasia || contrato.empresa.razaoSocial} · {contrato.orgaoNome}
            {contrato.ata && (
              <> · derivado da <Link href={`/atas/${contrato.ata.id}`} className="text-blue-700 hover:underline">Ata {contrato.ata.numero}</Link></>
            )}
            {contrato.criadoPor && (
              <> · criado por <strong>{contrato.criadoPor.nome}</strong></>
            )}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <AnaliseJuridicaIA contratoId={contrato.id} />
          {podeEditar && (
            <Link
              href={`/contratos/${contrato.id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="Editar dados do Contrato"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Link>
          )}
          <Link
            href="/contratacoes/nova/fornecimento"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Execução
          </Link>
          {podeEditar && <BotaoExcluirContrato contratoId={contrato.id} />}
        </div>
      </div>

      <AlertaReajuste
        marcoOrcamentoEstimado={contrato.marcoOrcamentoEstimado}
        hrefReajustes="/reajustes"
        contratoId={contrato.id}
      />

      <KpisSaldoVigencia saldo={saldo} />

      <div className="mt-8">
        <Tabs
          abas={[
            {
              key: "saldo",
              label: "Saldo de itens",
              content: (
                <SaldoVigenciasPanel
                  saldo={saldo}
                  tipoItens="CONTRATO"
                  contratoId={contrato.id}
                  podeIniciarManual={podeEditar && !isContratoNaoContinuado(contrato.tipo)}
                />
              ),
            },
            {
              key: "aditivos",
              label: "Aditivos",
              badge: contrato.termosAditivos.length,
              content: (
                <AditivosTab
                  aditivos={contrato.termosAditivos}
                  contratoId={contrato.id}
                  contratoTipo={contrato.tipo}
                  valorInicialContrato={contrato.valorInicial ?? saldo.valorTotal}
                  valorAtualContrato={saldo.valorTotal}
                />
              ),
            },
            {
              key: "apostilamentos",
              label: "Apostilamentos",
              badge: contrato.apostilamentos.length,
              content: (
                <ApostilamentosTab
                  apostilamentos={contrato.apostilamentos}
                  contratoId={contrato.id}
                  valorInicialContrato={contrato.valorInicial ?? saldo.valorTotal}
                  valorAtualContrato={saldo.valorTotal}
                />
              ),
            },
            {
              key: "reajustes",
              label: "Reajustes",
              badge:
                contrato.reajustes.length +
                contrato.termosAditivos.filter((a) => a.aplicaReajuste).length +
                contrato.apostilamentos.filter((a) => a.aplicaReajuste).length,
              content: (
                <ReajustesTab
                  reajustesLegado={contrato.reajustes}
                  aditivosComReajuste={contrato.termosAditivos
                    .filter((a) => a.aplicaReajuste)
                    .map((a) => ({
                      id: a.id,
                      numero: a.numero,
                      dataAssinatura: a.dataAssinatura,
                      reajusteIndice: a.reajusteIndice,
                      reajusteIndiceOutro: a.reajusteIndiceOutro,
                      reajustePercentual: a.reajustePercentual,
                      reajustePeriodoInicio: a.reajustePeriodoInicio,
                      reajustePeriodoFim: a.reajustePeriodoFim,
                      arquivoPdfUrl: a.arquivoPdfUrl,
                    }))}
                  apostilamentosComReajuste={contrato.apostilamentos
                    .filter((a) => a.aplicaReajuste)
                    .map((a) => ({
                      id: a.id,
                      numero: a.numero,
                      dataAssinatura: a.dataAssinatura,
                      reajusteIndice: a.reajusteIndice,
                      reajusteIndiceOutro: a.reajusteIndiceOutro,
                      reajustePercentual: a.reajustePercentual,
                      reajustePeriodoInicio: a.reajustePeriodoInicio,
                      reajustePeriodoFim: a.reajustePeriodoFim,
                      arquivoPdfUrl: a.arquivoPdfUrl,
                    }))}
                  marcoOrcamentoEstimado={contrato.marcoOrcamentoEstimado}
                />
              ),
            },
            {
              key: "garantias",
              label: "Garantias",
              badge: contrato.garantias.length,
              content: (
                <GarantiasTab
                  garantias={contrato.garantias}
                  contratoId={contrato.id}
                  temGarantia={contrato.temGarantia}
                />
              ),
            },
            {
              key: "enderecos",
              label: "Endereços / Pontos focais",
              badge: contrato.enderecosEntrega.length + contrato.pontosFocais.length,
              content: (
                <EnderecosPontosFocaisTab
                  enderecos={contrato.enderecosEntrega}
                  pontosFocais={contrato.pontosFocais}
                  contratoId={contrato.id}
                />
              ),
            },
            {
              key: "empenhos",
              label: "Execuções",
              badge: contrato.empenhos.length,
              content: <EmpenhosVinculados contratoId={contrato.id} empenhos={contrato.empenhos} />,
            },
            {
              key: "notificacoes",
              label: "Notificações",
              badge: contrato.notificacoes.length,
              content: <NotificacoesTab notificacoes={contrato.notificacoes} contratoId={contrato.id} />,
            },
            {
              key: "procedimentos",
              label: "Procedimentos apuratórios",
              badge: contrato.procedimentos.length,
              content: <ProcedimentosTab procedimentos={contrato.procedimentos} contratoId={contrato.id} />,
            },
            {
              key: "anexos",
              label: "Anexos",
              badge: contrato.anexos.length,
              content: <AnexosTab anexos={contrato.anexos} contratoId={contrato.id} />,
            },
            {
              key: "anotacoes",
              label: "Anotações",
              badge: contrato.anotacoes.length,
              content: <AnotacoesTab anotacoes={contrato.anotacoes} contratoId={contrato.id} />,
            },
            {
              key: "dados",
              label: "Dados",
              content: <DadosContrato c={contrato} />,
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
                  rotuloRecurso="Contrato"
                  pdfLink={{ tipo: "contrato", id: contrato.id }}
                  contrato={{
                    numero: contrato.numero,
                    vigenciaInicio: contrato.vigenciaInicio,
                    vigenciaFim: contrato.vigenciaFim,
                    dataAssinatura: contrato.dataAssinatura,
                    prazoEntregaDias: contrato.prazoEntregaDias,
                    prazoPagamentoDias: contrato.prazoPagamentoDias,
                    marcoOrcamentoEstimado: contrato.marcoOrcamentoEstimado,
                    itens: contrato.itens.map((i) => ({ quantidade: i.quantidade, valorTotal: i.valorTotal })),
                  }}
                  saldo={saldo}
                  qtdEmpenhos={contrato.empenhos.length}
                  empenhosPagos={contrato.empenhos.filter((e) => e.status === "PAGO").length}
                  qtdAditivos={contrato.termosAditivos.length}
                  aditivos={contrato.termosAditivos.map((a) => ({
                    alteraValor: a.alteraValor,
                    novoValor: a.novoValor,
                    alteraPrazoVigencia: a.alteraPrazoVigencia,
                    novaVigenciaFim: a.novaVigenciaFim,
                  }))}
                  qtdApostilamentos={contrato.apostilamentos.length}
                  qtdReajustes={contrato.reajustes.length}
                  qtdNotificacoes={contrato.notificacoes.length}
                  qtdProcedimentos={contrato.procedimentos.length}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function TabelaSaldoContrato({
  saldo,
}: {
  saldo: { itens: { contratoItemId: string; descricao: string; unidade: string; quantidadeTotal: number; quantidadeUsada: number; quantidadeDisponivel: number; valorDisponivel: number }[] };
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Descrição</th>
            <th className="px-4 py-2 text-left">Un.</th>
            <th className="px-4 py-2 text-right">Qtd. contratada</th>
            <th className="px-4 py-2 text-right">Qtd. executada</th>
            <th className="px-4 py-2 text-right">Qtd. a executar</th>
            <th className="px-4 py-2 text-right">Valor a executar</th>
          </tr>
        </thead>
        <tbody>
          {saldo.itens.map((it) => (
            <tr key={it.contratoItemId} className="border-t border-slate-100">
              <td className="px-4 py-2">{it.descricao}</td>
              <td className="px-4 py-2 text-slate-600">{it.unidade}</td>
              <td className="px-4 py-2 text-right">{it.quantidadeTotal}</td>
              <td className="px-4 py-2 text-right text-slate-600">{it.quantidadeUsada}</td>
              <td className="px-4 py-2 text-right">
                <span className={it.quantidadeDisponivel === 0 ? "text-red-600 font-medium" : "text-emerald-700 font-medium"}>
                  {it.quantidadeDisponivel}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-medium">{brl(it.valorDisponivel)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function empenhoEmExecucao(e: EmpenhoVinculado): boolean {
  // Empenho está "em execução" quando saiu do estado inicial — ou status avançou,
  // ou já há ao menos um marco posterior preenchido (caso editado retroativamente).
  return (
    e.status !== "EMPENHADO" ||
    !!e.dataPedidoRecebido ||
    !!e.dataDespacho ||
    !!e.dataEntrega ||
    !!e.dataNfEmitida ||
    !!e.dataNfEncaminhada ||
    !!e.dataPagamento
  );
}

type EmpenhoVinculado = {
  id: string;
  numero: string;
  status: string;
  instrumento: InstrumentoContratual;
  objeto: string;
  dataEmissao: Date;
  dataPedidoRecebido: Date | null;
  dataDespacho: Date | null;
  dataEntrega: Date | null;
  dataNfEmitida: Date | null;
  dataNfEncaminhada: Date | null;
  dataPagamento: Date | null;
};

function EmpenhosVinculados({ contratoId, empenhos }: { contratoId: string; empenhos: EmpenhoVinculado[] }) {
  if (empenhos.length === 0)
    return <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Nenhum empenho vinculado.</p>;
  return (
    <div className="space-y-3">
      {empenhos.map((e) => (
        <Link
          key={e.id}
          href={`/execucao/${e.id}?from=contrato-${contratoId}`}
          className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{labelInstrumento(e.instrumento)} {e.numero}</p>
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-800">
                  {e.status.replace(/_/g, " ")}
                </span>
              </div>
              {e.objeto && (
                <p className="mt-0.5 truncate text-xs text-slate-500">{e.objeto}</p>
              )}
              {empenhoEmExecucao(e) ? (
                <div className="mt-3">
                  <TimelineExecucao
                    status={e.status}
                    comDatas
                    compacta
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
              ) : (
                <p className="mt-3 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Aguardando início da execução. Empenhado em {e.dataEmissao.toLocaleDateString("pt-BR")} — quando o órgão emitir a ordem de fornecimento, a barra de status aparecerá aqui.
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function DadosContrato({
  c,
}: {
  c: {
    tipo: string; procedimentoSelecao: string; processoAdministrativo: string;
    numeroLicitacao: string | null; numeroNotaEmpenho: string | null;
    orgaoNome: string; orgaoCnpj: string; dataAssinatura: Date;
    dataPublicacao: Date | null; vigenciaInicio: Date; vigenciaFim: Date;
    prazoEntregaDias: number | null;
    prazoEntregaUnidade: "DIAS" | "MESES";
    prazoEntregaModo: "RELATIVO" | "DATA_CERTA" | "SOB_DEMANDA" | "PRAZO_CERTO";
    dataEntregaCerta: Date | null;
    prazoPagamentoDias: number | null;
    marcoReajusteOrigem: string | null;
    marcoOrcamentoEstimado: Date | null;
    modalidadeEntrega: string;
    marcoInicialPrazo: string | null;
    marcoInicialDescricao: string | null;
    parcelas: { id: string; numero: number; prazoDias: number; descricao: string | null; valorEstimado: number | null }[];
  };
}) {
  const naoContinuado = isContratoNaoContinuado(c.tipo as Parameters<typeof isContratoNaoContinuado>[0]);
  return (
    <div className="space-y-6">
      <div className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
        <Info label="Tipo" valor={ROTULO_TIPO[c.tipo as keyof typeof ROTULO_TIPO]} />
        <Info label="Procedimento" valor={ROTULO_PROCEDIMENTO[c.procedimentoSelecao as keyof typeof ROTULO_PROCEDIMENTO]} />
        <Info label="Processo administrativo" valor={c.processoAdministrativo} />
        <Info label="Nº Licitação" valor={c.numeroLicitacao || "—"} />
        <Info label="Nota de Empenho de suporte" valor={c.numeroNotaEmpenho || "—"} />
        <Info label="Órgão" valor={`${c.orgaoNome} (${formatarCnpj(c.orgaoCnpj)})`} />
        <Info label="Data de assinatura" valor={c.dataAssinatura.toLocaleDateString("pt-BR")} />
        <Info label="Data de publicação" valor={c.dataPublicacao?.toLocaleDateString("pt-BR") || "—"} />
        <Info label="Vigência" valor={`${c.vigenciaInicio.toLocaleDateString("pt-BR")} → ${c.vigenciaFim.toLocaleDateString("pt-BR")}`} />
        <Info
          label="Prazo de entrega"
          valor={
            c.prazoEntregaModo === "SOB_DEMANDA"
              ? "Sob demanda (a definir)"
              : c.prazoEntregaModo === "DATA_CERTA"
                ? c.dataEntregaCerta
                  ? `Data certa: ${c.dataEntregaCerta.toLocaleDateString("pt-BR")}`
                  : "Data certa não informada"
                : c.prazoEntregaDias
                  ? `${c.prazoEntregaDias} ${c.prazoEntregaUnidade === "MESES" ? (c.prazoEntregaDias === 1 ? "mês" : "meses") : "dias"}`
                  : "—"
          }
        />
        <Info label="Prazo de pagamento" valor={c.prazoPagamentoDias ? `${c.prazoPagamentoDias} dias` : "—"} />
        <Info
          label="Marco de reajuste"
          valor={
            c.marcoReajusteOrigem === "ASSINATURA"
              ? `Assinatura — próximo reajuste em ${calcularProximoReajusteContrato(c.dataAssinatura)}`
              : c.marcoReajusteOrigem === "ORCAMENTO_ESTIMADO" && c.marcoOrcamentoEstimado
                ? `Orçamento estimado em ${c.marcoOrcamentoEstimado.toLocaleDateString("pt-BR")} — próximo reajuste em ${calcularProximoReajusteContrato(c.marcoOrcamentoEstimado)}`
                : c.marcoReajusteOrigem === "OMISSA"
                  ? "Cláusula omissa (sem reajuste programado)"
                  : "—"
          }
        />
        <Info
          label="Modalidade de entrega"
          valor={ROTULO_MODALIDADE_ENTREGA[c.modalidadeEntrega as keyof typeof ROTULO_MODALIDADE_ENTREGA] || c.modalidadeEntrega}
        />
        <Info
          label="Marco inicial do prazo"
          valor={
            c.modalidadeEntrega === "SOB_DEMANDA"
              ? "—  (sob demanda)"
              : c.marcoInicialPrazo === "OUTRO"
                ? c.marcoInicialDescricao || "Outro documento hábil"
                : ROTULO_MARCO_INICIAL[c.marcoInicialPrazo as keyof typeof ROTULO_MARCO_INICIAL] || "—"
          }
        />
      </div>

      {naoContinuado && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Contrato não-continuado (Lei 14.133): encerra após cumprimento da obrigação. <strong>Não admite prorrogação de vigência</strong> via termo aditivo. Reajustes, apostilamentos e alteração de prazo de entrega seguem permitidos.
        </p>
      )}

      {c.modalidadeEntrega === "PARCELADA" && c.parcelas.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Cronograma de parcelas</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left font-medium">#</th>
                <th className="py-2 text-left font-medium">Prazo</th>
                <th className="py-2 text-left font-medium">Descrição</th>
                <th className="py-2 text-right font-medium">Valor estimado</th>
              </tr>
            </thead>
            <tbody>
              {c.parcelas.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-700">{p.numero}</td>
                  <td className="py-2 text-slate-600">{p.prazoDias} dias</td>
                  <td className="py-2 text-slate-600">{p.descricao || "—"}</td>
                  <td className="py-2 text-right tabular-nums text-slate-700">
                    {p.valorEstimado ? brl(p.valorEstimado) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor?: "emerald" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-2 text-2xl font-bold ${cor === "emerald" ? "text-emerald-700" : "text-slate-900"}`}>{valor}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
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

// Próximo reajuste = marco + 12 meses. Formato dd/mm/yyyy.
function calcularProximoReajusteContrato(marco: Date): string {
  const d = new Date(marco);
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("pt-BR");
}
