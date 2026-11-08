"use client";

import { useActionState, useState } from "react";
import { brl } from "@/lib/validators";
import { informarRetencaoAction } from "@/app/actions/contaVinculada";

/**
 * Bloco "Conta vinculada" no detalhe da competência (ESP-006 RN03): a
 * retenção estimada por rubrica e o valor efetivamente retido pelo órgão.
 */
export function RetencaoCvBloco({
  competenciaId,
  fatoGerador,
  estimada,
  informada,
  detalhe,
  podeEditar,
  onOk,
}: {
  competenciaId: string;
  fatoGerador: boolean;
  estimada: number | null;
  informada: number | null;
  detalhe: { porRubrica?: { codigo: string; rotulo: string; pct: number; valor: number }[]; semPlanilha?: string[]; totalPct?: number } | null;
  podeEditar: boolean;
  onOk: (m: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof informarRetencaoAction>>, fd: FormData) => {
      const r = await informarRetencaoAction(prev, fd);
      if (r?.ok && r.mensagem) {
        setEditando(false);
        onOk(r.mensagem);
      }
      return r;
    },
    null,
  );
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">{fatoGerador ? "Verbas provisionadas (fato gerador)" : "Conta vinculada"}</h2>
      <p className="text-[11px] text-slate-500">{fatoGerador ? "Parcelas que o órgão só paga quando o fato ocorre." : "Retenção do órgão para férias, 13º e rescisões."}</p>
      {estimada == null ? (
        <p className="mt-2 text-sm text-slate-500">Sem estimativa: cadastre a planilha de custos das funções e use “Recalcular” na aba Conta vinculada.</p>
      ) : (
        <dl className="mt-2 space-y-1 text-sm">
          {(detalhe?.porRubrica ?? []).map((r) => (
            <div key={r.codigo} className="flex justify-between gap-2">
              <dt className="text-slate-600">
                {r.rotulo} <span className="text-slate-400">{r.pct}%</span>
              </dt>
              <dd className="tabular-nums text-slate-900">{brl(r.valor)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-slate-100 pt-1 font-semibold">
            <dt className="text-slate-700">Estimada{detalhe?.totalPct ? ` (${detalhe.totalPct}%)` : ""}</dt>
            <dd className="tabular-nums">{brl(estimada)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-700">Informada (comprovante)</dt>
            <dd className={`tabular-nums ${informada != null ? "font-bold text-emerald-700" : "text-slate-400"}`}>{informada != null ? brl(informada) : "—"}</dd>
          </div>
          {detalhe?.semPlanilha && detalhe.semPlanilha.length > 0 && <p className="text-[11px] text-amber-800">Sem planilha de custos (não entram na estimativa): {detalhe.semPlanilha.join(", ")}.</p>}
        </dl>
      )}
      {podeEditar && (
        <div className="mt-3">
          {editando ? (
            <form action={action} className="flex flex-wrap items-end gap-2 text-xs">
              <input type="hidden" name="competenciaId" value={competenciaId} />
              <label className="block">
                <span className="font-semibold uppercase tracking-wide text-slate-500">Valor retido pelo órgão (R$)</span>
                <input name="valor" className="mt-1 w-40" inputMode="decimal" defaultValue={informada != null ? informada.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""} placeholder="0,00" />
              </label>
              <button type="submit" className="btn-primary" disabled={pending}>
                Salvar
              </button>
              {informada != null && (
                <button type="submit" name="limpar" value="1" className="btn-secondary" disabled={pending}>
                  Usar estimativa
                </button>
              )}
              <button type="button" className="text-slate-600 hover:underline" onClick={() => setEditando(false)}>
                cancelar
              </button>
              {state?.erro && <span className="text-red-700">{state.erro}</span>}
            </form>
          ) : (
            <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setEditando(true)}>
              {informada != null ? "Alterar valor informado" : "Informar o valor retido (comprovante)"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
