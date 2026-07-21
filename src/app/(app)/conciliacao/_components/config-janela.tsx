"use client";

import { useActionState } from "react";
import { configurarJanelaAction } from "@/app/actions/conciliacao";

export function ConfigJanela({ diaMes, optIn }: { diaMes: number | null; optIn: boolean }) {
  const [state, action, pending] = useActionState(configurarJanelaAction, null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Lembrete de conciliação</h2>
      <p className="mt-1 text-xs text-slate-600">
        Escolha o melhor dia do mês pra receber lembrete de subir o extrato. Enviamos 5 dias antes, 1 dia antes e no dia — pelo WhatsApp que você tem cadastrado.
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-xs text-slate-700">
          Dia do mês
          <select
            name="diaMes"
            defaultValue={diaMes ?? ""}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">— não configurado —</option>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            name="optIn"
            defaultChecked={optIn}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ativar lembretes
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {state?.ok ? <span className="text-xs text-emerald-700">Salvo!</span> : null}
        {state?.erro ? <span className="text-xs text-red-700">{state.erro}</span> : null}
      </form>
    </div>
  );
}
