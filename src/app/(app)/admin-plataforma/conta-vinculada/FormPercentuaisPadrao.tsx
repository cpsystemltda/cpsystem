"use client";

import { useActionState, useState } from "react";
import { salvarPercentuaisPadraoAction } from "@/app/actions/contaVinculada";
import { totalPct, type PercentuaisContaVinculada, type Rat } from "@/lib/contaVinculada";

export function FormPercentuaisPadrao({ atual, original }: { atual: PercentuaisContaVinculada; original: PercentuaisContaVinculada }) {
  const [state, action, pending] = useActionState(salvarPercentuaisPadraoAction, null);
  const [vals, setVals] = useState({
    decimoTerceiro: String(atual.decimoTerceiro),
    feriasTerco: String(atual.feriasTerco),
    multaFgts: String(atual.multaFgts),
    incidencia1: String(atual.incidencia22["1"]),
    incidencia2: String(atual.incidencia22["2"]),
    incidencia3: String(atual.incidencia22["3"]),
  });
  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const p: PercentuaisContaVinculada = { decimoTerceiro: n(vals.decimoTerceiro), feriasTerco: n(vals.feriasTerco), multaFgts: n(vals.multaFgts), incidencia22: { "1": n(vals.incidencia1), "2": n(vals.incidencia2), "3": n(vals.incidencia3) } };
  const campos: [keyof typeof vals, string, number][] = [
    ["decimoTerceiro", "13º salário", original.decimoTerceiro],
    ["feriasTerco", "Férias e 1/3 constitucional", original.feriasTerco],
    ["multaFgts", "Multa do FGTS e contribuição social sobre o aviso prévio", original.multaFgts],
    ["incidencia1", "Incidência do submódulo 2.2 — RAT 1%", original.incidencia22["1"]],
    ["incidencia2", "Incidência do submódulo 2.2 — RAT 2%", original.incidencia22["2"]],
    ["incidencia3", "Incidência do submódulo 2.2 — RAT 3%", original.incidencia22["3"]],
  ];
  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-6">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 text-left font-semibold">Rubrica</th>
            <th className="w-40 py-2 text-right font-semibold">Percentual (%)</th>
            <th className="w-32 py-2 text-right font-semibold">IN 5/2017</th>
          </tr>
        </thead>
        <tbody>
          {campos.map(([k, rotulo, orig]) => (
            <tr key={k} className="border-t border-slate-100">
              <td className="py-2 text-slate-800">{rotulo}</td>
              <td className="py-2 text-right">
                <input name={k} className="w-32 text-right" inputMode="decimal" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
              </td>
              <td className="py-2 text-right tabular-nums text-slate-500">{orig.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
            </tr>
          ))}
          {([1, 2, 3] as Rat[]).map((rat) => (
            <tr key={rat} className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td className="py-2 text-slate-800">Total com RAT {rat}%</td>
              <td className="py-2 text-right tabular-nums">{totalPct(p, rat).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
              <td className="py-2 text-right tabular-nums text-slate-500">{totalPct(original, rat).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {state?.erro && <p className="mt-3 text-sm text-red-700">{state.erro}</p>}
      {state?.ok && state.mensagem && <p className="mt-3 text-sm text-emerald-700">{state.mensagem}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => setVals({ decimoTerceiro: String(original.decimoTerceiro), feriasTerco: String(original.feriasTerco), multaFgts: String(original.multaFgts), incidencia1: String(original.incidencia22["1"]), incidencia2: String(original.incidencia22["2"]), incidencia3: String(original.incidencia22["3"]) })}>
          Restaurar os valores da IN
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar tabela-padrão"}
        </button>
      </div>
    </form>
  );
}
