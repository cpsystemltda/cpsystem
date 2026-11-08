"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarSearch, Check, Plus, X } from "lucide-react";
import { ROTULO_MOTIVO_FIM, ROTULO_TIPO_ALOCACAO, TIPOS_ALOCACAO, type TipoAlocacao } from "@/lib/colaboradores";
import { dataBrDia } from "@/lib/competencias";
import type { QuadroContrato } from "@/lib/colaboradoresServer";
import { alocarAction, encerrarAlocacaoAction, type ResultadoColab } from "@/app/actions/colaboradores";
import { useFormAction } from "@/lib/useFormAction";

/**
 * Aba "Equipe alocada" do contrato de mão de obra (ESP-008): quadro por
 * posto (necessários × alocados, descobertos), alocação, encerramento e a
 * consulta "quem ocupava cada posto em tal data" (RN07).
 */
export function EquipeAlocadaTab({
  contratoId,
  quadro,
  dia,
  hojeIso,
  podeVer,
  podeEditar,
  colaboradores,
}: {
  contratoId: string;
  quadro: QuadroContrato;
  dia: string; // yyyy-mm-dd consultado
  hojeIso: string;
  podeVer: boolean;
  podeEditar: boolean;
  colaboradores: { id: string; nome: string; funcao: string; cpfMascarado: string }[];
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [alocando, setAlocando] = useState(false);
  // Sem reset automático: num bloqueio (titular em dois postos) a pessoa
  // troca o tipo para cobertura e reenvia, sem preencher tudo de novo.
  const { state, onSubmit, pending } = useFormAction<ResultadoColab>(alocarAction, (r) => {
    setAlocando(false);
    setAviso(r.mensagem ?? null);
    router.refresh();
  });
  const consultandoPassado = dia !== hojeIso;

  return (
    <div className="space-y-4">
      {aviso && (
        <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          <Check className="h-4 w-4" /> {aviso}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex items-end gap-2 text-xs">
          <input type="hidden" name="aba" value="equipe" />
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Posição em</span>
            <input name="dia" type="date" defaultValue={dia} className="mt-1 block" />
          </label>
          <button type="submit" className="btn-secondary inline-flex">
            <CalendarSearch className="h-4 w-4" /> Consultar
          </button>
          {consultandoPassado && (
            <Link href={`/contratos/${contratoId}?aba=equipe`} className="text-slate-600 underline">
              voltar para hoje
            </Link>
          )}
        </form>
        {podeEditar && !consultandoPassado && (
          <button type="button" className="btn-primary inline-flex" onClick={() => setAlocando((v) => !v)}>
            <Plus className="h-4 w-4" /> Alocar colaborador
          </button>
        )}
      </div>

      {alocando && podeEditar && (
        <form onSubmit={onSubmit} className="rounded-2xl border border-violet-200 bg-white p-4">
          <input type="hidden" name="contratoId" value={contratoId} />
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-900">Nova alocação</p>
            <button type="button" onClick={() => setAlocando(false)} aria-label="Fechar">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Colaborador</span>
              <select name="colaboradorId" required className="mt-1 w-full" defaultValue="">
                <option value="" disabled>
                  Escolha…
                </option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.funcao} · {c.cpfMascarado}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Posto</span>
              <select name="contratoItemId" className="mt-1 w-full" defaultValue={quadro.linhas[0]?.id ?? ""}>
                <option value="">— (volante)</option>
                {quadro.linhas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.descricao} ({l.alocados}/{l.necessarios})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
              <select name="tipo" className="mt-1 w-full" defaultValue="TITULAR">
                {TIPOS_ALOCACAO.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_ALOCACAO[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Início</span>
              <input name="dataInicio" type="date" required className="mt-1 w-full" defaultValue={hojeIso} />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Fim (cobertura)</span>
              <input name="dataFim" type="date" className="mt-1 w-full" />
            </label>
            <label className="block text-xs sm:col-span-4">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Observação</span>
              <input name="observacao" className="mt-1 w-full" />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Titular é dedicação exclusiva: o mesmo colaborador não pode ser titular em dois postos ao mesmo tempo. Cobertura temporária em outro contrato é permitida.</p>
          {state?.erro && (
            <p className="mt-2 inline-flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.erro}
            </p>
          )}
          <div className="mt-3 flex justify-end">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Salvando…" : "Alocar"}
            </button>
          </div>
        </form>
      )}

      {/* Quadro por posto (RN05) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Posto / função</th>
              <th className="px-3 py-2 text-right font-semibold">Necessários</th>
              <th className="px-3 py-2 text-right font-semibold">Alocados</th>
              <th className="px-3 py-2 text-right font-semibold">Titulares</th>
              <th className="px-3 py-2 text-right font-semibold">Coberturas</th>
              <th className="px-3 py-2 text-left font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody>
            {quadro.linhas.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{l.descricao}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.necessarios}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{l.alocados}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{l.titulares}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">{l.coberturas}</td>
                <td className="px-3 py-2 text-xs">
                  {l.descobertos > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">
                      <AlertTriangle className="h-3 w-3" /> posto descoberto: {l.descobertos}
                    </span>
                  ) : l.excedentes > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">{l.excedentes} acima do necessário</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">completo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-xs">
              <td className="px-3 py-2 font-semibold text-slate-700" colSpan={2}>
                {quadro.totalAlocados} colaborador(es) no contrato em {dataBrDia(dia)} · {quadro.volantes} volante(s)
              </td>
              <td className="px-3 py-2 text-right font-semibold" colSpan={4}>
                {quadro.descobertosTotal > 0 ? <span className="text-red-700">{quadro.descobertosTotal} posto(s) descoberto(s)</span> : <span className="text-emerald-700">todos os postos cobertos</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Ocupantes (RN07) */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{consultandoPassado ? `Quem ocupava cada posto em ${dataBrDia(dia)}` : "Quem ocupa cada posto hoje"}</h4>
          {!podeVer && <p className="text-[11px] text-slate-500">Sem a permissão “Dados de colaboradores” os nomes ficam ocultos.</p>}
        </header>
        {quadro.alocacoes.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">Ninguém alocado nesta data.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {quadro.alocacoes.map((a) => (
              <LinhaAlocacao key={a.id} a={a} contratoId={contratoId} podeVer={podeVer} podeEditar={podeEditar && !consultandoPassado} hojeIso={hojeIso} onOk={(m) => { setAviso(m); router.refresh(); }} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinhaAlocacao({ a, contratoId, podeVer, podeEditar, hojeIso, onOk }: { a: QuadroContrato["alocacoes"][number]; contratoId: string; podeVer: boolean; podeEditar: boolean; hojeIso: string; onOk: (m: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [state, action, pending] = useActionState<ResultadoColab, FormData>(
    async (p, fd) => {
      const r = await encerrarAlocacaoAction(p, fd);
      if (r?.ok) onOk(r.mensagem ?? "Alocação encerrada.");
      return r;
    },
    null,
  );
  return (
    <li className="px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {podeVer ? (
            <Link href={`/colaboradores/${a.colaboradorId}`} className="font-semibold text-slate-900 hover:underline">
              {a.colaboradorNome}
            </Link>
          ) : (
            <span className="font-semibold text-slate-500">Colaborador</span>
          )}
          <span className="ml-2 font-mono text-xs text-slate-500">{a.cpfMascarado}</span>
          <span className="ml-2 text-slate-600">{a.itemDescricao ?? "volante"}</span>
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{ROTULO_TIPO_ALOCACAO[a.tipo as TipoAlocacao]}</span>
          <span className="ml-2 text-xs text-slate-500">
            desde {dataBrDia(a.dataInicio)}
            {a.dataFim ? ` até ${dataBrDia(a.dataFim)}` : ""}
          </span>
        </span>
        {podeEditar && !a.dataFim && (
          <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setAberto((v) => !v)}>
            encerrar
          </button>
        )}
      </div>
      {aberto && (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="contratoId" value={contratoId} />
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Fim</span>
            <input name="dataFim" type="date" required className="mt-1" defaultValue={hojeIso} />
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Motivo</span>
            <select name="motivo" className="mt-1" defaultValue="TROCA">
              {Object.entries(ROTULO_MOTIVO_FIM).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn-secondary" disabled={pending}>
            Encerrar
          </button>
          {state?.erro && <span className="text-red-700">{state.erro}</span>}
        </form>
      )}
    </li>
  );
}
