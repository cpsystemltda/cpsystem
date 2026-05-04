import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ClipboardList, Receipt } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoContrato } from "@/lib/saldo";
import { brl, formatarCnpj, ROTULO_PROCEDIMENTO, ROTULO_TIPO } from "@/lib/validators";
import { Tabs } from "@/components/Tabs";
import { AditivosTab } from "@/components/abas/AditivosTab";
import { ApostilamentosTab } from "@/components/abas/ApostilamentosTab";
import { ReajustesTab } from "@/components/abas/ReajustesTab";
import { GarantiasTab } from "@/components/abas/GarantiasTab";
import { NotificacoesTab } from "@/components/abas/NotificacoesTab";
import { ProcedimentosTab } from "@/components/abas/ProcedimentosTab";
import { AnexosTab, AnotacoesTab } from "@/components/abas/AnexosTab";
import { EnderecosPontosFocaisTab } from "@/components/abas/OrgaosTab";

export default async function ContratoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const contrato = await prisma.contrato.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      empresa: true,
      ata: true,
      empenhos: { orderBy: { criadoEm: "desc" } },
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

  const saldo = await calcularSaldoContrato(contrato.id);

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
          </p>
        </div>
        <Link
          href="/contratacoes/nova/empenho"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          + Empenho
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat titulo="Valor total contratado" valor={brl(saldo.valorTotal)} />
        <Stat titulo="Já executado" valor={brl(saldo.valorUsado)} sub={`${saldo.percentualUsado.toFixed(1)}%`} />
        <Stat titulo="A executar" valor={brl(saldo.valorDisponivel)} cor="emerald" />
      </div>

      <div className="mt-8">
        <Tabs
          abas={[
            {
              key: "saldo",
              label: "Saldo de itens",
              content: <TabelaSaldoContrato saldo={saldo} />,
            },
            {
              key: "aditivos",
              label: "Aditivos",
              badge: contrato.termosAditivos.length,
              content: <AditivosTab aditivos={contrato.termosAditivos} contratoId={contrato.id} />,
            },
            {
              key: "apostilamentos",
              label: "Apostilamentos",
              badge: contrato.apostilamentos.length,
              content: <ApostilamentosTab apostilamentos={contrato.apostilamentos} contratoId={contrato.id} />,
            },
            {
              key: "reajustes",
              label: "Reajustes",
              badge: contrato.reajustes.length,
              content: <ReajustesTab reajustes={contrato.reajustes} contratoId={contrato.id} />,
            },
            {
              key: "garantias",
              label: "Garantias",
              badge: contrato.garantias.length,
              content: <GarantiasTab garantias={contrato.garantias} contratoId={contrato.id} />,
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
              label: "Empenhos",
              badge: contrato.empenhos.length,
              content: <EmpenhosVinculados empenhos={contrato.empenhos} />,
            },
            {
              key: "notificacoes",
              label: "Notificações",
              badge: contrato.notificacoes.length,
              content: <NotificacoesTab notificacoes={contrato.notificacoes} contratoId={contrato.id} />,
            },
            {
              key: "procedimentos",
              label: "Procedimentos",
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

function EmpenhosVinculados({ empenhos }: { empenhos: { id: string; numero: string; status: string }[] }) {
  if (empenhos.length === 0)
    return <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Nenhum empenho vinculado.</p>;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {empenhos.map((e) => (
        <Link key={e.id} href={`/execucao/${e.id}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-300">
          <Receipt className="h-4 w-4 text-amber-600" />
          <div>
            <div className="text-sm font-medium">Empenho {e.numero}</div>
            <div className="text-xs text-slate-500">Status: {e.status}</div>
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
    prazoEntregaDias: number | null; prazoPagamentoDias: number | null;
  };
}) {
  return (
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
      <Info label="Prazo de entrega" valor={c.prazoEntregaDias ? `${c.prazoEntregaDias} dias` : "—"} />
      <Info label="Prazo de pagamento" valor={c.prazoPagamentoDias ? `${c.prazoPagamentoDias} dias` : "—"} />
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
