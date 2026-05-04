import Link from "next/link";
import {
  Workflow,
  Truck,
  Clock,
  AlertTriangle,
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  Calendar,
  FileText,
  Building2,
} from "lucide-react";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TimelineExecucao } from "@/components/TimelineExecucao";

const ROTULO_STATUS: Record<string, string> = {
  EMPENHADO: "Empenhado",
  PEDIDO_RECEBIDO: "Pedido recebido",
  EM_TRANSITO: "Em trânsito",
  ENTREGUE: "Entregue",
  NF_EMITIDA: "NF emitida",
  NF_ENCAMINHADA: "NF encaminhada",
  PAGO: "Pago",
};

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function OperacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const usuario = await exigirUsuario();
  const sp = await searchParams;
  const aba = sp.aba || "execucao";
  const hoje = new Date();
  const em30dias = new Date(hoje.getTime() + 30 * 86400000);
  const contaId = usuario.contaId;

  // Carrega tudo de uma vez
  const [empenhosEmExecucao, contratosPertoVencer, notificacoesAbertas, procedimentosAbertos, contadores] =
    await Promise.all([
      // Em execução: empenhos não pagos
      prisma.empenho.findMany({
        where: { empresa: { contaId }, status: { not: "PAGO" } },
        include: {
          empresa: { select: { nomeFantasia: true, razaoSocial: true } },
          itens: { select: { valorTotal: true } },
        },
        orderBy: { criadoEm: "desc" },
      }),
      // Perto de vencer: contratos + atas com vigenciaFim em ≤ 30 dias
      prisma.contrato.findMany({
        where: {
          empresa: { contaId },
          vigenciaFim: { gte: hoje, lte: em30dias },
        },
        include: {
          empresa: { select: { nomeFantasia: true, razaoSocial: true } },
          itens: { select: { valorTotal: true } },
        },
        orderBy: { vigenciaFim: "asc" },
      }),
      // Com pendência: notificações de órgão sem resposta
      prisma.notificacao.findMany({
        where: {
          status: { in: ["RECEBIDA", "EM_TRATATIVA"] },
          OR: [
            { ata: { empresa: { contaId } } },
            { contrato: { empresa: { contaId } } },
            { empenho: { empresa: { contaId } } },
          ],
        },
        include: {
          ata: { include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } } },
          contrato: { include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } } },
          empenho: { include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } } },
        },
        orderBy: { dataRecebimento: "desc" },
      }),
      // Com ocorrência: procedimentos apuratórios em curso
      prisma.procedimentoApuratorio.findMany({
        where: {
          arquivado: false,
          OR: [
            { ata: { empresa: { contaId } } },
            { contrato: { empresa: { contaId } } },
            { empenho: { empresa: { contaId } } },
          ],
        },
        include: {
          ata: { include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } } },
          contrato: { include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } } },
          empenho: { include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } } },
          penalidades: { select: { tipo: true } },
        },
        orderBy: { dataAbertura: "desc" },
      }),
      Promise.resolve({}),
    ]);

  const cnt = {
    execucao: empenhosEmExecucao.length,
    vencer: contratosPertoVencer.length,
    pendencia: notificacoesAbertas.length,
    ocorrencia: procedimentosAbertos.length,
  };

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
            <Workflow className="h-3.5 w-3.5" /> Operação da equipe
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Tudo que precisa de ação agora
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Centraliza contratações em execução, vencimentos próximos, pendências e ocorrências. Use abas pra filtrar.
          </p>
        </div>
        <Link
          href="/contratacoes/nova"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          + Cadastrar
        </Link>
      </div>

      {/* Cards categoria */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardCategoria
          ativa={aba === "execucao"}
          href="/operacao?aba=execucao"
          titulo="Em execução"
          qtd={cnt.execucao}
          sub="Empenhos não pagos"
          icone={Truck}
          cor="blue"
        />
        <CardCategoria
          ativa={aba === "vencer"}
          href="/operacao?aba=vencer"
          titulo="Perto de vencer"
          qtd={cnt.vencer}
          sub="Contratos vencendo em ≤30 dias"
          icone={Clock}
          cor="amber"
        />
        <CardCategoria
          ativa={aba === "pendencia"}
          href="/operacao?aba=pendencia"
          titulo="Com pendência"
          qtd={cnt.pendencia}
          sub="Notificações sem resposta"
          icone={AlertTriangle}
          cor="violet"
        />
        <CardCategoria
          ativa={aba === "ocorrencia"}
          href="/operacao?aba=ocorrencia"
          titulo="Com ocorrência"
          qtd={cnt.ocorrencia}
          sub="Procedimentos em curso"
          icone={AlertOctagon}
          cor="red"
        />
      </div>

      {/* Conteúdo da aba */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {aba === "execucao" && (
          <>
            <CabecalhoAba
              titulo="Empenhos em execução"
              subtitulo="Linha do tempo da entrega — do empenhado ao pagamento"
              total={empenhosEmExecucao.length}
            />
            {empenhosEmExecucao.length === 0 ? (
              <Vazio
                icone={CheckCircle2}
                titulo="Nenhum empenho em execução"
                texto="Quando você cadastrar empenhos não pagos, eles aparecem aqui."
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {empenhosEmExecucao.map((e) => {
                  const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/execucao/${e.id}`}
                        className="block rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              Empenho {e.numero} · {e.objeto.slice(0, 60)}
                              {e.objeto.length > 60 ? "…" : ""}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {e.orgaoNome} · {e.empresa.nomeFantasia || e.empresa.razaoSocial}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-800">
                            {ROTULO_STATUS[e.status] || e.status}
                          </span>
                        </div>
                        <div className="mt-3"><TimelineExecucao status={e.status} compacta /></div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Vence em{" "}
                            <strong className="text-slate-900">
                              {e.vigenciaFim.toLocaleDateString("pt-BR")}
                            </strong>
                          </span>
                          <span className="font-semibold text-slate-900">{brl(valor)}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {aba === "vencer" && (
          <>
            <CabecalhoAba
              titulo="Contratos perto de vencer"
              subtitulo="Próximos 30 dias — antecipe renovação ou aditivo"
              total={contratosPertoVencer.length}
            />
            {contratosPertoVencer.length === 0 ? (
              <Vazio
                icone={CheckCircle2}
                titulo="Nenhum contrato vencendo em 30 dias"
                texto="Tudo sob controle! Quando algum contrato se aproximar do vencimento, aparece aqui."
              />
            ) : (
              <ul className="mt-4 space-y-2">
                {contratosPertoVencer.map((c) => {
                  const dias = Math.ceil((c.vigenciaFim.getTime() - hoje.getTime()) / 86400000);
                  const valor = c.itens.reduce((s, i) => s + i.valorTotal, 0);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/contratos/${c.id}`}
                        className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-amber-300 hover:shadow-sm"
                      >
                        <span
                          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                            dias <= 7
                              ? "bg-red-100 text-red-700"
                              : dias <= 15
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {dias}d
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            Contrato {c.numero} · {c.objeto.slice(0, 60)}
                            {c.objeto.length > 60 ? "…" : ""}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {c.orgaoNome} · {c.empresa.nomeFantasia || c.empresa.razaoSocial} · vence em{" "}
                            {c.vigenciaFim.toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-slate-900">{brl(valor)}</span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {aba === "pendencia" && (
          <>
            <CabecalhoAba
              titulo="Notificações com pendência"
              subtitulo="Notificações de órgão público sem resposta ou em tratativa"
              total={notificacoesAbertas.length}
            />
            {notificacoesAbertas.length === 0 ? (
              <Vazio
                icone={CheckCircle2}
                titulo="Nenhuma pendência aberta"
                texto="Todas as notificações de órgão estão respondidas ou finalizadas."
              />
            ) : (
              <ul className="mt-4 space-y-2">
                {notificacoesAbertas.map((n) => {
                  const pai = n.contrato || n.empenho || n.ata;
                  const empresa =
                    pai?.empresa.nomeFantasia || pai?.empresa.razaoSocial || "—";
                  const link = n.ataId
                    ? `/atas/${n.ataId}`
                    : n.contratoId
                    ? `/contratos/${n.contratoId}`
                    : `/execucao/${n.empenhoId}`;
                  const dias = Math.floor(
                    (hoje.getTime() - n.dataRecebimento.getTime()) / 86400000,
                  );
                  return (
                    <li key={n.id}>
                      <Link
                        href={link}
                        className="flex items-start gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-violet-300 hover:shadow-sm"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {n.assunto}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.descricao}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {empresa} · recebida há {dias}d ·{" "}
                            <span
                              className={`font-medium ${
                                n.status === "RECEBIDA" ? "text-amber-700" : "text-blue-700"
                              }`}
                            >
                              {n.status === "RECEBIDA" ? "Aguardando análise" : "Em tratativa"}
                            </span>
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {aba === "ocorrencia" && (
          <>
            <CabecalhoAba
              titulo="Procedimentos apuratórios em curso"
              subtitulo="Defesa, recurso e penalidades em andamento"
              total={procedimentosAbertos.length}
            />
            {procedimentosAbertos.length === 0 ? (
              <Vazio
                icone={CheckCircle2}
                titulo="Nenhum procedimento aberto"
                texto="Sem ocorrências apuratórias contra sua empresa no momento."
              />
            ) : (
              <ul className="mt-4 space-y-2">
                {procedimentosAbertos.map((p) => {
                  const pai = p.contrato || p.empenho || p.ata;
                  const empresa = pai?.empresa.nomeFantasia || pai?.empresa.razaoSocial || "—";
                  const link = p.ataId
                    ? `/atas/${p.ataId}`
                    : p.contratoId
                    ? `/contratos/${p.contratoId}`
                    : `/execucao/${p.empenhoId}`;
                  const temPenalidade = p.penalidades.length > 0;
                  return (
                    <li key={p.id}>
                      <Link
                        href={link}
                        className="flex items-start gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-red-300 hover:shadow-sm"
                      >
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700">
                          <AlertOctagon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{p.assunto}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.descricao}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {empresa} · aberto em {p.dataAbertura.toLocaleDateString("pt-BR")} · prazo defesa{" "}
                            {p.prazoDefesaDias}d
                          </p>
                        </div>
                        {temPenalidade && (
                          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Penalidade aplicada
                          </span>
                        )}
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CardCategoria({
  ativa,
  href,
  titulo,
  qtd,
  sub,
  icone: Icone,
  cor,
}: {
  ativa: boolean;
  href: string;
  titulo: string;
  qtd: number;
  sub: string;
  icone: React.ComponentType<{ className?: string }>;
  cor: "blue" | "amber" | "violet" | "red";
}) {
  const map = {
    blue: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-500" },
    amber: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-500" },
    violet: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-500" },
    red: { bg: "bg-red-100", text: "text-red-700", border: "border-red-500" },
  };
  const c = map[cor];
  return (
    <Link
      href={href}
      className={`group rounded-2xl border-2 bg-white p-4 transition ${
        ativa ? `${c.border} shadow-md` : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${c.bg} ${c.text}`}>
          <Icone className="h-5 w-5" />
        </div>
        <span className={`text-3xl font-bold ${ativa ? c.text : "text-slate-900"}`}>{qtd}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{titulo}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </Link>
  );
}

function CabecalhoAba({ titulo, subtitulo, total }: { titulo: string; subtitulo: string; total: number }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
        {total} {total === 1 ? "item" : "itens"}
      </span>
    </div>
  );
}

function Vazio({
  icone: Icone,
  titulo,
  texto,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="mt-6 grid place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-14 text-center">
      <Icone className="h-10 w-10 text-emerald-400" />
      <p className="mt-3 text-sm font-semibold text-slate-900">{titulo}</p>
      <p className="mt-1 max-w-md text-xs text-slate-500">{texto}</p>
    </div>
  );
}

