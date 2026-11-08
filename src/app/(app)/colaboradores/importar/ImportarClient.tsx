"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AVISO_SEM_DADOS_DE_SAUDE } from "@/lib/lgpd";
import { importarColaboradoresAction, type ResultadoColab } from "@/app/actions/colaboradores";

export function ImportarClient() {
  const [state, action, pending] = useActionState<ResultadoColab, FormData>(importarColaboradoresAction, null);
  return (
    <div className="mt-6 space-y-4">
      <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Planilha preenchida (.xlsx, .xls ou .csv)</span>
          <input name="arquivo" type="file" required accept=".xlsx,.xls,.csv" className="mt-1 block w-full text-sm" />
        </label>
        <p className="mt-2 text-[11px] text-slate-500">{AVISO_SEM_DADOS_DE_SAUDE}</p>
        {state?.erro && <p className="mt-2 text-sm text-red-700">{state.erro}</p>}
        <div className="mt-3 flex justify-end">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Importando…" : "Importar"}
          </button>
        </div>
      </form>

      {state?.ok && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            {state.criados} colaborador(es) cadastrado(s) · {state.rejeitadas?.length ?? 0} linha(s) rejeitada(s)
          </p>
          {state.rejeitadas && state.rejeitadas.length > 0 && (
            <table className="mt-3 w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-1 text-left">Linha</th>
                  <th className="py-1 text-left">Motivo</th>
                  <th className="py-1 text-left">Trecho</th>
                </tr>
              </thead>
              <tbody>
                {state.rejeitadas.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-2 tabular-nums">{r.linha}</td>
                    <td className="py-1 pr-2 text-red-800">{r.motivo}</td>
                    <td className="py-1 font-mono text-slate-500">{r.trecho}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-sm">
            <Link href="/colaboradores" className="font-semibold text-blue-700 hover:underline">
              Ver colaboradores
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
