import Link from "next/link";
import { Plus, Receipt, Truck } from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { brl } from "@/lib/validators";
import { FiltroLista } from "@/components/FiltroLista";
import { filtroEmpresaWhere } from "@/lib/empresaContexto";
import { BannerEmpresaEmFoco } from "@/components/BannerEmpresaEmFoco";
import { PageHeader } from "@/components/ui/SecaoGlass";
import { labelInstrumento } from "@/lib/instrumentoLabel";

const ROTULO_STATUS: Record<string, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito",
  ENTREGUE: "Entregue",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  PAGO: "Pago",
};

const COR_STATUS: Record<string, string> = {
  EMPENHADO: "bg-slate-100 text-slate-700",
  PEDIDO_RECEBIDO: "bg-blue-100 text-blue-700",
  EM_TRANSITO: "bg-indigo-100 text-indigo-700",
  ENTREGUE: "bg-violet-100 text-violet-700",
  NF_EMITIDA: "bg-amber-100 text-amber-800",
  NF_ENCAMINHADA: "bg-orange-100 text-orange-800",
  PAGO: "bg-emerald-100 text-emerald-800",
};

export default async function ExecucaoPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    orgao?: string;
    de?: string; // data emissão >= (filtro por período)
    ate?: string; // data emissão <= (filtro por período)
    ataId?: string;
    contratoId?: string;
  }>;
}) {
  const usuario = await exigirUsuario();
  const filtroEmpresa = await filtroEmpresaWhere(usuario.contaId);
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const statusFiltro = sp.status || "";
  const orgao = sp.orgao || "";
  const de = sp.de || "";
  const ate = sp.ate || "";
  const ataId = sp.ataId || "";
  const contratoId = sp.contratoId || "";

  const dataEmissaoFiltro =
    de || ate
      ? {
          ...(de && { gte: new Date(de) }),
          ...(ate && { lte: new Date(`${ate}T23:59:59`) }),
        }
      : undefined;

  const empenhos = await prisma.empenho.findMany({
    where: {
      empresa: filtroEmpresa,
      ...(q && {
        OR: [
          { numero: { contains: q } },
          { objeto: { contains: q } },
          { processoAdministrativo: { contains: q } },
          { orgaoNome: { contains: q } },
        ],
      }),
      ...(statusFiltro && {
        status: statusFiltro as
          | "EMPENHADO"
          | "PEDIDO_RECEBIDO"
          | "EM_TRANSITO"
          | "ENTREGUE"
          | "NF_EMITIDA"
          | "NF_ENCAMINHADA"
          | "PAGO",
      }),
      ...(orgao && { orgaoNome: orgao }),
      ...(dataEmissaoFiltro && { dataEmissao: dataEmissaoFiltro }),
      ...(ataId && { ataId }),
      ...(contratoId && { contratoId }),
    },
    orderBy: { criadoEm: "desc" },
    include: {
      empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      itens: { select: { valorTotal: true } },
    },
  });

  const [orgaosDistintos, atasOpcoes, contratosOpcoes] = await Promise.all([
    prisma.empenho.groupBy({
      by: ["orgaoNome"],
      where: { empresa: filtroEmpresa },
      orderBy: { orgaoNome: "asc" },
    }),
    prisma.ata.findMany({
      where: { empresa: filtroEmpresa, empenhos: { some: {} } },
      select: { id: true, numero: true },
      orderBy: { numero: "asc" },
    }),
    prisma.contrato.findMany({
      where: { empresa: filtroEmpresa, empenhos: { some: {} } },
      select: { id: true, numero: true },
      orderBy: { numero: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-8 py-8">
      <BannerEmpresaEmFoco contaId={usuario.contaId} />
      <PageHeader
        eyebrow="Operação · Logística"
        titulo="Fornecimento &"
        destaque="Execução"
        subtitulo={`${empenhos.length} execução(ões) — empenhos, AE, OS, AC, Cartas-Contrato.`}
        cta={
          <Link href="/contratacoes/nova/fornecimento" className="btn-primary">
            <Plus className="h-4 w-4" /> Nova execução
          </Link>
        }
      />

      <div className="mt-6">
        <FiltroLista
          placeholderBusca="Buscar empenhos…"
          filtros={[
            {
              name: "status",
              label: "Todos os status",
              opcoes: Object.entries(ROTULO_STATUS).map(([k, v]) => ({ value: k, label: v })),
            },
            {
              name: "orgao",
              label: "Todos os órgãos",
              opcoes: orgaosDistintos.map((o) => ({ value: o.orgaoNome, label: o.orgaoNome })),
            },
            ...(atasOpcoes.length > 0
              ? [
                  {
                    name: "ataId",
                    label: "Todas as Atas",
                    opcoes: atasOpcoes.map((a) => ({ value: a.id, label: `Ata ${a.numero}` })),
                  },
                ]
              : []),
            ...(contratosOpcoes.length > 0
              ? [
                  {
                    name: "contratoId",
                    label: "Todos os Contratos",
                    opcoes: contratosOpcoes.map((c) => ({
                      value: c.id,
                      label: `Contrato ${c.numero}`,
                    })),
                  },
                ]
              : []),
            { name: "de", label: "De:", tipo: "date" as const },
            { name: "ate", label: "Até:", tipo: "date" as const },
          ]}
        />
      </div>

      {empenhos.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <Truck className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Nenhuma execução encontrada</h3>
          <Link href="/contratacoes/nova/fornecimento" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Cadastrar primeira execução
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {empenhos.map((e) => {
            const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
            const prazo = e.dataPedidoRecebido && e.prazoEntregaDias
              ? new Date(e.dataPedidoRecebido.getTime() + e.prazoEntregaDias * 86400000)
              : null;
            const atrasoDias = prazo && !e.dataEntrega ? Math.ceil((Date.now() - prazo.getTime()) / 86400000) : 0;
            return (
              <Link
                key={e.id}
                href={`/execucao/${e.id}`}
                className="glass-tile group block rounded-[18px] px-5 py-5 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-amber-50">
                      <Receipt className="h-5 w-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {labelInstrumento(e.instrumento)} {e.numero}
                        <span className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${COR_STATUS[e.status]}`}>{ROTULO_STATUS[e.status]}</span>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 truncate">{e.objeto}</p>
                      <p className="mt-2 text-xs text-slate-500">{e.orgaoNome} · {e.empresa.nomeFantasia || e.empresa.razaoSocial}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Valor empenhado</div>
                    <div className="mt-0.5 text-base font-bold text-slate-900">{brl(valor)}</div>
                    {atrasoDias > 0 && <div className="mt-1 text-xs font-medium text-red-600">⚠ Atraso de {atrasoDias}d</div>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
