import Link from "next/link";
import { Plus, Receipt, Truck, AlertTriangle } from "lucide-react";
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
  EM_TRANSITO: "Em trânsito/Em execução",
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
    /** "1" = só NF parada há mais de 30 dias (o card de atrasados do dashboard). */
    atrasadas?: string;
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
  // Igor 24/08: o dashboard acusava 11 notas em atraso, mas o clique trazia as
  // 20 em aberto — sem como saber quais eram as 11. Este filtro aplica o mesmo
  // critério do card: NF emitida (ou encaminhada) há mais de 30 dias e o órgão
  // ainda não pagou.
  const soAtrasadas = sp.atrasadas === "1";
  const limiteAtraso = new Date(Date.now() - 30 * 86400000);

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
      ...(soAtrasadas && {
        status: { in: ["NF_EMITIDA", "NF_ENCAMINHADA"] as const },
        OR: [
          { dataNfEncaminhada: { lte: limiteAtraso } },
          { dataNfEncaminhada: null, dataNfEmitida: { lte: limiteAtraso } },
        ],
      }),
      ...(dataEmissaoFiltro && { dataEmissao: dataEmissaoFiltro }),
      ...(ataId && { ataId }),
      ...(contratoId && { contratoId }),
    },
    orderBy: { criadoEm: "desc" },
    include: {
      empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      itens: { select: { valorTotal: true } },
      // Numero da NF na listagem (Igor, 28/08): é o dado que a pessoa procura
      // pra conferir com o extrato bancário e com o órgão.
      notasFiscais: {
        where: { status: "AUTORIZADA" },
        select: { numero: true },
        orderBy: { criadoEm: "desc" },
        take: 1,
      },
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
        subtitulo={
          soAtrasadas
            ? `${empenhos.length} nota(s) em atraso — emitidas há mais de 30 dias e ainda não pagas pelo órgão.`
            : `${empenhos.length} execução(ões) — empenhos, AE, OS, AC, Cartas-Contrato.`
        }
        cta={
          <div className="flex flex-wrap items-center gap-2">
            {/* Igor (28/08): "isso já dá pra ver na aba pelo status". Dá pra ver
                O QUE está em cada etapa — não QUANTO está parado nem HÁ QUANTO
                TEMPO. O painel responde essas duas, e o atalho fica aqui pra
                não virar tela paralela que ninguém encontra. */}
            <Link href="/notas" className="btn-secondary">
              <Receipt className="h-4 w-4" /> Controle de notas
            </Link>
            <Link href="/contratacoes/nova/fornecimento" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova execução
            </Link>
          </div>
        }
      />

      {soAtrasadas && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Mostrando <strong>somente as notas em atraso</strong> (NF há mais de 30 dias sem
            pagamento do órgão).
          </span>
          <Link href="/execucao" className="font-semibold underline">
            Ver todas as execuções
          </Link>
        </div>
      )}

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
            // Conta dias só por dia calendário UTC (não conta horas).
            // Day-of-prazo ainda é tempestivo; atraso começa no dia seguinte.
            const atrasoDias = (() => {
              if (!prazo || e.dataEntrega) return 0;
              const dia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
              const n = new Date();
              const hoje = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
              return Math.max(0, Math.round((hoje - dia(prazo)) / 86400000));
            })();
            return (
              <Link
                key={e.id}
                href={`/execucao/${e.id}`}
                className="glass-tile group block overflow-hidden rounded-[18px] px-5 py-5 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-50">
                      <Receipt className="h-5 w-5 text-amber-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-slate-900">
                          {labelInstrumento(e.instrumento)} {e.numero}
                        </h3>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${COR_STATUS[e.status]}`}>
                          {ROTULO_STATUS[e.status]}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">{e.objeto}</p>
                      <p className="mt-2 truncate text-xs text-slate-500">
                        {e.orgaoNome} · {e.empresa.nomeFantasia || e.empresa.razaoSocial}
                        {e.notasFiscais[0]?.numero && (
                          <span className="ms-1 font-semibold text-emerald-700">
                            · NF nº {e.notasFiscais[0].numero}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
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
