"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Check, ChevronRight, Pause, Plus, RefreshCw, X } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  ROTULO_STATUS,
  dataBrDia,
  faturadaOuAlem,
  rotuloCompetencia,
  type StatusCompetencia,
} from "@/lib/competencias";
import type { ResumoCompetencia } from "@/lib/competenciasServer";
import { indicadorGlosas } from "@/lib/glosas";
import {
  criarCompetenciaComplementarAction,
  decidirRetroativasAction,
  gerarPendentesAction,
  registrarSuspensaoAction,
} from "@/app/actions/competencias";

/**
 * Aba "Competências" do contrato de mão de obra (ESP-004). A lista mensal
 * nasce sozinha (rotina diária); aqui a pessoa decide sobre os meses já
 * transcorridos (RN08), acompanha previsto/faturado/líquido/recebido e
 * atraso, e registra complementar (RN09) e suspensão (RN10).
 */

const COR_STATUS: Record<StatusCompetencia, string> = {
  A_CONFIRMAR: "bg-amber-100 text-amber-900",
  EM_EXECUCAO: "bg-slate-100 text-slate-700",
  MEDICAO: "bg-sky-100 text-sky-800",
  DOC_TRABALHISTA: "bg-sky-100 text-sky-800",
  NF_EMITIDA: "bg-violet-100 text-violet-800",
  NF_ENCAMINHADA: "bg-violet-100 text-violet-800",
  ATESTADA: "bg-emerald-100 text-emerald-800",
  PAGA: "bg-emerald-600 text-white",
};

export function ChipStatusCompetencia({ status, atraso }: { status: StatusCompetencia; atraso?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR_STATUS[status]}`}>
      {ROTULO_STATUS[status]}
      {status === "PAGA" && atraso ? ` · ${atraso}d de atraso` : ""}
    </span>
  );
}

export function CompetenciasTab({
  contratoId,
  competencias,
  podeEditar,
  geraCompetencias,
  precisaDecidir,
  faltantes,
  suspensao,
  hojeIso,
}: {
  contratoId: string;
  competencias: ResumoCompetencia[];
  podeEditar: boolean;
  geraCompetencias: boolean;
  precisaDecidir: boolean;
  faltantes: number;
  suspensao: { inicio: string | null; fim: string | null };
  hojeIso: string;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [form, setForm] = useState<"complementar" | "suspensao" | null>(null);

  const totais = competencias.reduce(
    (t, c) => {
      t.previsto += c.valorPrevisto;
      if (faturadaOuAlem(c.status)) t.faturado += c.valorFaturado;
      if (c.valorRecebido != null) t.recebido += c.valorRecebido;
      if (c.atrasoDias > 0 && c.status !== "PAGA") t.emAtraso++;
      if (c.status === "A_CONFIRMAR") t.aConfirmar++;
      if (c.empenhoInsuficiente) t.empenhoInsuficiente++;
      return t;
    },
    { previsto: 0, faturado: 0, recebido: 0, emAtraso: 0, aConfirmar: 0, empenhoInsuficiente: 0 },
  );
  // ESP-005 RN05: total glosado e % sobre o faturado (faturado + glosado).
  const glosas = indicadorGlosas(competencias.map((c) => ({ valorFaturado: c.valorFaturado, valorGlosas: c.valorGlosas, faturada: faturadaOuAlem(c.status) })));

  function rodar(fn: () => Promise<{ ok?: boolean; erro?: string; mensagem?: string } | null>) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await fn();
      if (r?.erro) setErro(r.erro);
      else {
        if (r?.mensagem) setAviso(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {aviso && (
        <p className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <span className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" /> {aviso}
          </span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}
      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      {!geraCompetencias && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          As competências nascem sozinhas depois que os valores dos postos forem confirmados como mensais (aviso no topo da página).
        </div>
      )}

      {geraCompetencias && precisaDecidir && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-sm font-semibold text-violet-950">Este contrato já está em andamento. Gerar as competências já transcorridas desta vigência?</p>
          <p className="mt-1 text-xs text-violet-800">
            Elas entram como <strong>a confirmar</strong>, com o valor previsto de cada mês, para você preencher medição, nota e pagamento no seu ritmo. Se preferir, só os próximos meses são criados.
          </p>
          {podeEditar && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pendente} className="btn-primary inline-flex" onClick={() => rodar(() => decidirRetroativasAction(contratoId, true))}>
                <CalendarDays className="h-4 w-4" /> Sim, gerar para conferência
              </button>
              <button type="button" disabled={pendente} className="btn-secondary inline-flex" onClick={() => rodar(() => decidirRetroativasAction(contratoId, false))}>
                Não, só daqui em diante
              </button>
            </div>
          )}
        </div>
      )}

      {suspensao.inicio && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm text-slate-800">
          <span className="inline-flex items-center gap-2">
            <Pause className="h-4 w-4" /> Contrato suspenso de {dataBrDia(suspensao.inicio)}
            {suspensao.fim ? ` a ${dataBrDia(suspensao.fim)}` : " (sem fim definido)"}: nenhuma competência nasce nesse período.
          </span>
          {podeEditar && (
            <button type="button" className="text-xs text-slate-700 hover:underline" onClick={() => setForm("suspensao")}>
              Alterar
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
          <Resumo rotulo="Previsto (todas)" valor={brl(totais.previsto)} />
          <Resumo rotulo="Faturado (NF emitida)" valor={brl(totais.faturado)} />
          <Resumo rotulo="Glosado" valor={glosas.glosado ? `${brl(glosas.glosado)} · ${glosas.percentual}%` : "—"} destaque={glosas.glosado > 0} />
          <Resumo rotulo="Recebido" valor={brl(totais.recebido)} />
          <Resumo
            rotulo="Atenção"
            valor={
              [totais.aConfirmar ? `${totais.aConfirmar} a confirmar` : "", totais.emAtraso ? `${totais.emAtraso} em atraso` : "", totais.empenhoInsuficiente ? `${totais.empenhoInsuficiente} sem empenho suficiente` : ""]
                .filter(Boolean)
                .join(" · ") || "nada pendente"
            }
            destaque={totais.aConfirmar + totais.emAtraso + totais.empenhoInsuficiente > 0}
          />
        </dl>
        {podeEditar && geraCompetencias && (
          <div className="flex flex-wrap gap-2">
            {faltantes > 0 && (
              <button type="button" disabled={pendente} className="btn-secondary inline-flex" onClick={() => rodar(() => gerarPendentesAction(contratoId))} title="Meses já iniciados que ainda não têm competência">
                <RefreshCw className="h-4 w-4" /> Gerar pendentes ({faltantes})
              </button>
            )}
            <button type="button" className="btn-secondary inline-flex" onClick={() => setForm(form === "complementar" ? null : "complementar")}>
              <Plus className="h-4 w-4" /> Complementar
            </button>
            {!suspensao.inicio && (
              <button type="button" className="btn-secondary inline-flex" onClick={() => setForm(form === "suspensao" ? null : "suspensao")}>
                <Pause className="h-4 w-4" /> Suspensão
              </button>
            )}
          </div>
        )}
      </div>

      {form === "complementar" && <FormComplementar contratoId={contratoId} hojeIso={hojeIso} onFechar={() => setForm(null)} onOk={(m) => { setForm(null); setAviso(m); router.refresh(); }} />}
      {form === "suspensao" && <FormSuspensao contratoId={contratoId} suspensao={suspensao} onFechar={() => setForm(null)} onOk={(m) => { setForm(null); setAviso(m); router.refresh(); }} />}

      {competencias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          {geraCompetencias ? "Nenhuma competência ainda. A do mês corrente é criada pela rotina diária; use “Gerar pendentes” para abrir agora." : "Nenhuma competência."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Competência</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Previsto</th>
                <th className="px-3 py-2 text-right font-semibold">Faturado</th>
                <th className="px-3 py-2 text-right font-semibold">Líquido esperado</th>
                <th className="px-3 py-2 text-right font-semibold">Recebido</th>
                <th className="px-3 py-2 text-left font-semibold">Pagamento</th>
                <th className="px-3 py-2 text-left font-semibold">Empenho</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {competencias.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2">
                    <Link href={`/competencias/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                      {rotuloCompetencia(c.competencia)}
                    </Link>
                    {c.tipo === "COMPLEMENTAR" && <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-800">complementar</span>}
                    <p className="text-[11px] text-slate-500">
                      {dataBrDia(c.periodoInicio)} a {dataBrDia(c.periodoFim)}
                      {c.diasPeriodo < c.diasBase && c.tipo === "REGULAR" ? ` · ${c.diasPeriodo}/${c.diasBase} dias` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <ChipStatusCompetencia status={c.status} atraso={c.atrasoDias} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(c.valorPrevisto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {faturadaOuAlem(c.status) ? brl(c.valorFaturado) : <span className="text-slate-400" title="Previsto − glosas ± ajustes; fixa na emissão da NF">{brl(c.valorFaturado)}*</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{faturadaOuAlem(c.status) ? brl(c.valorLiquidoEsperado) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.valorRecebido != null ? brl(c.valorRecebido) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.status === "PAGA" ? (
                      <span className={c.pagaComAtraso ? "text-amber-700" : "text-emerald-700"}>
                        {c.pagaComAtraso ? `Paga com ${c.atrasoDias}d de atraso` : "Paga no prazo"}
                      </span>
                    ) : c.prazoPagamento ? (
                      <span className={c.atrasoDias > 0 ? "font-semibold text-red-700" : "text-slate-700"}>
                        {c.atrasoDias > 0 ? `Vencido há ${c.atrasoDias}d` : `Prazo ${dataBrDia(c.prazoPagamento)}`}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.empenhos.length === 0 ? (
                      <span className="text-slate-400">sem empenho</span>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {c.empenhos.map((e) => e.numero).join(", ")}
                        {c.empenhoInsuficiente && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800" title="Empenho insuficiente para a competência">
                            <AlertTriangle className="h-3 w-3" /> insuficiente
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link href={`/competencias/${c.id}`} aria-label="Abrir competência" className="text-slate-400 hover:text-slate-700">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">* previsto − glosas ± ajustes; o faturado fica fixo quando a NF é emitida.</p>
        </div>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${destaque ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className={`mt-0.5 font-semibold tabular-nums ${destaque ? "text-amber-900" : "text-slate-900"}`}>{valor}</dd>
    </div>
  );
}

function FormComplementar({ contratoId, hojeIso, onFechar, onOk }: { contratoId: string; hojeIso: string; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof criarCompetenciaComplementarAction>>, fd: FormData) => {
      const r = await criarCompetenciaComplementarAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Competência complementar</p>
          <p className="text-xs text-slate-600">Diferença retroativa de repactuação ou reajuste, discriminada mês a mês (RN09). Uma linha por mês afetado no detalhamento.</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Mês de referência</span>
          <input name="competencia" type="month" required className="mt-1 w-full" defaultValue={hojeIso.slice(0, 7)} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Valor total (R$)</span>
          <input name="valor" required inputMode="decimal" className="mt-1 w-full" placeholder="0,00" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Apostila / aditivo de origem</span>
          <input name="complementarRef" required className="mt-1 w-full" placeholder="Ex.: Apostila nº 02/2026" />
        </label>
        <label className="block text-xs sm:col-span-3">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Detalhamento mês a mês</span>
          <textarea name="detalhe" rows={3} className="mt-1 w-full" placeholder={"janeiro/2026: R$ 12.345,67\nfevereiro/2026: R$ 12.345,67"} />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Criar complementar"}
        </button>
      </div>
    </form>
  );
}

function FormSuspensao({ contratoId, suspensao, onFechar, onOk }: { contratoId: string; suspensao: { inicio: string | null; fim: string | null }; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof registrarSuspensaoAction>>, fd: FormData) => {
      const r = await registrarSuspensaoAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  return (
    <form action={action} className="rounded-xl border border-slate-300 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Suspensão do contrato</p>
          <p className="text-xs text-slate-600">Registrada por apostila ou notificação do órgão. Nenhuma competência nasce no período (RN10).</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Início</span>
          <input name="inicio" type="date" className="mt-1 w-full" defaultValue={suspensao.inicio?.slice(0, 10) ?? ""} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Fim (opcional)</span>
          <input name="fim" type="date" className="mt-1 w-full" defaultValue={suspensao.fim?.slice(0, 10) ?? ""} />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        {suspensao.inicio && (
          <button type="submit" name="limpar" value="1" className="btn-secondary" disabled={pending}>
            Remover suspensão
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Registrar"}
        </button>
      </div>
    </form>
  );
}
