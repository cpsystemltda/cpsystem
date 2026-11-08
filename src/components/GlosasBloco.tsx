"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Plus, Scale, Sparkles, Trash2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import { dataBrDia } from "@/lib/competencias";
import {
  ROTULO_STATUS_GLOSA,
  ROTULO_TIPO_GLOSA,
  TIPOS_GLOSA,
  ajusteImr,
  somaGlosasAtivas,
  type FaixaImr,
  type StatusGlosa,
  type TipoGlosa,
} from "@/lib/glosas";
import type { GlosaDto, ResumoCompetencia } from "@/lib/competenciasServer";
import {
  criarGlosaAction,
  excluirGlosaAction,
  gerarMinutaContestacaoAction,
  mudarStatusGlosaAction,
  registrarImrAction,
  salvarContestacaoAction,
} from "@/app/actions/glosas";

/**
 * Bloco "Medição e glosas" da competência (ESP-005). Glosas com status e
 * contestação (minuta pela IA), e IMR quando o contrato tem indicadores.
 */

export type IndicadorImrDto = { id: string; nome: string; meta: string | null; descricao: string | null; faixas: FaixaImr[] };

const COR_STATUS: Record<StatusGlosa, string> = {
  APLICADA: "bg-amber-100 text-amber-900",
  CONTESTADA: "bg-sky-100 text-sky-800",
  MANTIDA: "bg-slate-200 text-slate-800",
  REVERTIDA: "bg-emerald-100 text-emerald-800",
};

export function GlosasBloco({
  c,
  itens,
  indicadores,
  podeEditar,
  hojeIso,
  onAviso,
}: {
  c: ResumoCompetencia;
  itens: { id: string; descricao: string }[];
  indicadores: IndicadorImrDto[];
  podeEditar: boolean;
  hojeIso: string;
  onAviso: (m: string) => void;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [contestando, setContestando] = useState<string | null>(null);
  const total = somaGlosasAtivas(c.glosas.map((g) => ({ valor: g.valor, status: g.status as StatusGlosa })));

  function rodar(fn: () => Promise<{ ok?: boolean; erro?: string; mensagem?: string } | null>) {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (r?.erro) setErro(r.erro);
      else {
        if (r?.mensagem) onAviso(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Medição e glosas</h2>
          <p className="text-xs text-slate-500">
            Descontos aplicados pelo órgão neste mês. Total glosado: <strong className="text-slate-800">{brl(total)}</strong>
            {c.faturadoFixado && " · a NF já foi emitida: glosa nova não muda o faturado, fica para contestação e relatório."}
          </p>
        </div>
        {podeEditar && (
          <button type="button" className="btn-secondary inline-flex" onClick={() => setAdicionando((v) => !v)}>
            <Plus className="h-4 w-4" /> Glosa
          </button>
        )}
      </header>
      {erro && <p className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}

      {adicionando && podeEditar && (
        <FormGlosa competenciaId={c.id} itens={itens} hojeIso={hojeIso} onFechar={() => setAdicionando(false)} onOk={(m) => { setAdicionando(false); onAviso(m); router.refresh(); }} />
      )}

      <div className="px-4 py-3">
        {c.glosas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma glosa registrada neste mês.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {c.glosas.map((g) => (
              <li key={g.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa] ?? g.tipo}
                      {g.itemDescricao ? <span className="font-normal text-slate-600"> · {g.itemDescricao}</span> : ""}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR_STATUS[g.status as StatusGlosa]}`}>{ROTULO_STATUS_GLOSA[g.status as StatusGlosa]}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      {dataBrDia(g.data)} · {g.motivo}
                      {g.competenciaOrigemRef ? ` · referente a ${g.competenciaOrigemRef}` : ""}
                      {g.arquivoUrl && (
                        <a href={g.arquivoUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-700 hover:underline">
                          <FileText className="h-3 w-3" /> documento
                        </a>
                      )}
                      {g.complementarId && (
                        <a href={`/competencias/${g.complementarId}`} className="ml-2 text-emerald-700 hover:underline">
                          complementar gerada
                        </a>
                      )}
                    </p>
                  </div>
                  <p className={`text-right text-sm font-bold tabular-nums ${g.status === "REVERTIDA" ? "text-slate-400 line-through" : "text-slate-900"}`}>− {brl(g.valor)}</p>
                </div>
                {podeEditar && g.status !== "REVERTIDA" && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50" onClick={() => setContestando(contestando === g.id ? null : g.id)}>
                      <Scale className="h-3.5 w-3.5" /> {g.contestacao ? "Contestação" : "Contestar"}
                    </button>
                    {g.status !== "MANTIDA" && (
                      <button type="button" className="rounded-md border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50" disabled={pendente} onClick={() => rodar(() => mudarStatusGlosaAction(g.id, "MANTIDA"))}>
                        Mantida pelo órgão
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-emerald-800 hover:bg-emerald-50"
                      disabled={pendente}
                      onClick={() => confirm(c.faturadoFixado ? "Reverter a glosa? Como a NF já foi emitida, a diferença vira uma competência complementar." : "Reverter a glosa? Ela deixa de descontar do valor a receber.") && rodar(() => mudarStatusGlosaAction(g.id, "REVERTIDA"))}
                    >
                      Revertida
                    </button>
                    {!g.complementarId && (
                      <button type="button" className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-red-700 hover:bg-red-50" disabled={pendente} onClick={() => confirm("Excluir esta glosa?") && rodar(() => excluirGlosaAction(g.id))}>
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    )}
                  </div>
                )}
                {contestando === g.id && <PainelContestacao glosa={g} podeEditar={podeEditar} onFechar={() => setContestando(null)} onOk={(m) => { onAviso(m); router.refresh(); }} />}
              </li>
            ))}
          </ul>
        )}
      </div>

      {indicadores.length > 0 && <PainelImr c={c} indicadores={indicadores} podeEditar={podeEditar} hojeIso={hojeIso} onOk={(m) => { onAviso(m); router.refresh(); }} />}
    </section>
  );
}

function FormGlosa({ competenciaId, itens, hojeIso, onFechar, onOk }: { competenciaId: string; itens: { id: string; descricao: string }[]; hojeIso: string; onFechar: () => void; onOk: (m: string) => void }) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof criarGlosaAction>>, fd: FormData) => {
      const r = await criarGlosaAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  return (
    <form action={action} className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
      <input type="hidden" name="competenciaId" value={competenciaId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Data</span>
          <input name="data" type="date" required className="mt-1 w-full" defaultValue={hojeIso} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
          <select name="tipo" className="mt-1 w-full" defaultValue="POSTO_DESCOBERTO">
            {TIPOS_GLOSA.filter((t) => t !== "IMR").map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_GLOSA[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Valor (R$)</span>
          <input name="valor" required inputMode="decimal" className="mt-1 w-full" placeholder="0,00" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Posto / função</span>
          <select name="contratoItemId" className="mt-1 w-full" defaultValue="">
            <option value="">—</option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.descricao}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs sm:col-span-3">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Motivo (como o órgão descreveu)</span>
          <input name="motivo" required className="mt-1 w-full" placeholder="Ex.: posto descoberto em 3 dias sem reposição" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Documento do órgão</span>
          <input name="arquivo" type="file" accept="application/pdf,image/png,image/jpeg" className="mt-1 w-full text-xs" />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Referente a outra competência? (desconto de mês já pago)</span>
          <input name="competenciaOrigemRef" className="mt-1 w-full" placeholder="Ex.: setembro/2026" />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Registrar glosa"}
        </button>
      </div>
    </form>
  );
}

function PainelContestacao({ glosa, podeEditar, onFechar, onOk }: { glosa: GlosaDto; podeEditar: boolean; onFechar: () => void; onOk: (m: string) => void }) {
  const [texto, setTexto] = useState(glosa.contestacao ?? "");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof salvarContestacaoAction>>, fd: FormData) => {
      const r = await salvarContestacaoAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarMinutaContestacaoAction(glosa.id);
      if (r?.erro) setErro(r.erro);
      else if (r?.texto) {
        setTexto(r.texto);
        onOk("Minuta gerada. Revise antes de protocolar.");
      }
    } finally {
      setGerando(false);
    }
  }
  return (
    <form action={action} className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
      <input type="hidden" name="glosaId" value={glosa.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-900">Contestação da glosa</p>
        <div className="flex items-center gap-2">
          {podeEditar && (
            <button type="button" className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60" disabled={gerando} onClick={gerar}>
              <Sparkles className="h-3.5 w-3.5" /> {gerando ? "Gerando minuta…" : texto ? "Gerar outra minuta com IA" : "Gerar minuta com IA"}
            </button>
          )}
          <button type="button" onClick={onFechar} aria-label="Fechar">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-slate-600">A minuta usa a glosa, o regime legal e os dados do contrato. Onde faltar informação ela deixa [colchetes] para você completar.</p>
      <textarea name="contestacao" rows={texto ? 14 : 5} className="mt-2 w-full font-mono text-xs" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Texto da contestação (ou gere a minuta com a IA)" readOnly={!podeEditar} />
      {(erro || state?.erro) && <p className="mt-1 text-xs text-red-700">{erro ?? state?.erro}</p>}
      {podeEditar && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button type="submit" className="btn-secondary" disabled={pending}>
            Salvar texto
          </button>
          {glosa.status === "APLICADA" && (
            <button type="submit" name="marcarContestada" value="1" className="btn-primary" disabled={pending}>
              Salvar e marcar como contestada
            </button>
          )}
        </div>
      )}
    </form>
  );
}

function PainelImr({ c, indicadores, podeEditar, hojeIso, onOk }: { c: ResumoCompetencia; indicadores: IndicadorImrDto[]; podeEditar: boolean; hojeIso: string; onOk: (m: string) => void }) {
  const [pont, setPont] = useState<Record<string, string>>(Object.fromEntries(indicadores.map((i) => [i.id, String(c.imrPontuacoes.find((p) => p.indicadorId === i.id)?.pontuacao ?? "")])));
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof registrarImrAction>>, fd: FormData) => {
      const r = await registrarImrAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  const pontuacoes = indicadores.map((i) => ({ indicadorId: i.id, pontuacao: Number(String(pont[i.id] ?? "").replace(",", ".")) })).filter((p) => pont[p.indicadorId] !== "" && Number.isFinite(p.pontuacao));
  const r = ajusteImr(indicadores, pontuacoes);
  const valor = Math.round(c.valorPrevisto * (r.descontoPct / 100) * 100) / 100;
  return (
    <form action={action} className="border-t border-slate-100 px-4 py-3">
      <input type="hidden" name="competenciaId" value={c.id} />
      <input type="hidden" name="data" value={hojeIso} />
      <input type="hidden" name="pontuacoes" value={JSON.stringify(pontuacoes)} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IMR — instrumento de medição de resultado</p>
      <p className="text-[11px] text-slate-500">Informe a pontuação de cada indicador no mês; o desconto é a soma dos descontos das faixas e vira uma glosa do tipo IMR.</p>
      <table className="mt-2 w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1 text-left">Indicador</th>
            <th className="w-28 py-1 text-right">Pontuação</th>
            <th className="w-28 py-1 text-right">% do valor</th>
            <th className="w-24 py-1 text-right">Desconto</th>
          </tr>
        </thead>
        <tbody>
          {indicadores.map((i) => {
            const d = r.detalhes.find((x) => x.indicadorId === i.id);
            return (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-1 pr-2">
                  <span className="font-medium text-slate-800">{i.nome}</span>
                  {i.meta && <span className="ml-1 text-slate-500">· meta {i.meta}</span>}
                  <span className="block text-[10px] text-slate-400">{i.faixas.map((f) => `${f.de}–${f.ate} = ${f.percentualPagamento}%`).join(" · ")}</span>
                </td>
                <td className="py-1">
                  <input className="w-full !py-1 text-right" inputMode="decimal" data-imr={i.id} aria-label={`Pontuação de ${i.nome}`} value={pont[i.id] ?? ""} onChange={(e) => setPont({ ...pont, [i.id]: e.target.value })} disabled={!podeEditar || c.faturadoFixado} />
                </td>
                <td className="py-1 text-right tabular-nums">{d ? (d.percentualPagamento == null ? <span className="text-amber-700">sem faixa</span> : `${d.percentualPagamento}%`) : "—"}</td>
                <td className="py-1 text-right tabular-nums">{d && d.descontoPct ? `−${d.descontoPct}%` : "—"}</td>
              </tr>
            );
          })}
          <tr className="border-t border-slate-200 font-semibold">
            <td className="py-1.5 text-slate-800" colSpan={3}>
              Ajuste calculado: {r.descontoPct ? `−${r.descontoPct}%` : "sem desconto"}
            </td>
            <td className="py-1.5 text-right tabular-nums">{valor ? `− ${brl(valor)}` : "—"}</td>
          </tr>
        </tbody>
      </table>
      {r.semFaixa.length > 0 && (
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-800">
          <AlertTriangle className="h-3 w-3" /> Pontuação fora das faixas de: {r.semFaixa.join(", ")}.
        </p>
      )}
      {state?.erro && <p className="mt-1 text-xs text-red-700">{state.erro}</p>}
      {podeEditar && !c.faturadoFixado && (
        <div className="mt-2 flex justify-end">
          <button type="submit" className="btn-secondary" disabled={pending}>
            {pending ? "Aplicando…" : "Aplicar IMR nesta competência"}
          </button>
        </div>
      )}
    </form>
  );
}
