"use client";

import { useActionState } from "react";
import { definirRetencaoDadosAction, type ResultadoLgpd } from "@/app/actions/lgpd";

/** ESP-007 RN07: prazo de guarda dos dados de colaboradores após o fim do contrato. */
export function RetencaoDadosForm({ anosAtual, ehAdmin }: { anosAtual: number; ehAdmin: boolean }) {
  const [state, action, pending] = useActionState<ResultadoLgpd | null, FormData>(definirRetencaoDadosAction, null);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
      <label className="block text-xs">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Anos de guarda após o encerramento</span>
        <select name="anos" defaultValue={String(anosAtual)} className="mt-1 block" disabled={!ehAdmin}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} ano{n > 1 ? "s" : ""}
              {n === 5 ? " (padrão)" : ""}
            </option>
          ))}
        </select>
      </label>
      {ehAdmin && (
        <button type="submit" className="btn-secondary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar prazo"}
        </button>
      )}
      {state?.erro && <span className="text-xs text-red-700">{state.erro}</span>}
      {state?.ok && state.mensagem && <span className="text-xs text-emerald-700">{state.mensagem}</span>}
    </form>
  );
}
