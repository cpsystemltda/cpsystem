"use client";

import { useActionState } from "react";
import { brl } from "@/lib/validators";
import { criarReajusteAction } from "@/app/actions/contratuais";

type Reajuste = {
  id: string;
  dataPedido: Date;
  dataAprovacao: Date | null;
  indice: string;
  percentual: number;
  valorAnterior: number;
  valorNovo: number;
  instrumento: string;
  instrumentoNumero: string | null;
  observacoes: string | null;
};

export function ReajustesTab({
  reajustes,
  contratoId,
  empenhoId,
}: {
  reajustes: Reajuste[];
  contratoId?: string;
  empenhoId?: string;
}) {
  const [state, formAction] = useActionState(criarReajusteAction, null);

  return (
    <div className="space-y-6">
      {reajustes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Pedido</th>
                <th className="px-3 py-2 text-left">Aprovação</th>
                <th className="px-3 py-2 text-left">Índice</th>
                <th className="px-3 py-2 text-right">%</th>
                <th className="px-3 py-2 text-right">Anterior</th>
                <th className="px-3 py-2 text-right">Novo</th>
                <th className="px-3 py-2 text-left">Instrumento</th>
              </tr>
            </thead>
            <tbody>
              {reajustes.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{r.dataPedido.toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2">{r.dataAprovacao?.toLocaleDateString("pt-BR") || "—"}</td>
                  <td className="px-3 py-2">{r.indice}</td>
                  <td className="px-3 py-2 text-right">{r.percentual.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right">{brl(r.valorAnterior)}</td>
                  <td className="px-3 py-2 text-right font-medium">{brl(r.valorNovo)}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.instrumento.replace("_", " ")} {r.instrumentoNumero}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Registrar reajuste</summary>
        <form action={formAction} className="mt-4 grid grid-cols-3 gap-3 text-sm">
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <Campo label="Data do pedido" name="dataPedido" type="date" required />
          <Campo label="Data aprovação" name="dataAprovacao" type="date" />
          <Sel
            label="Índice"
            name="indice"
            options={["IPCA", "IGPM", "INCC", "INPC", "CONTRATUAL", "OUTRO"]}
            required
          />
          <Campo label="Percentual (%)" name="percentual" type="number" step="0.01" required />
          <Campo label="Valor anterior" name="valorAnterior" type="number" step="0.01" required />
          <Sel label="Instrumento" name="instrumento" options={["TERMO_ADITIVO", "APOSTILAMENTO"]} required />
          <Campo label="Nº Instrumento" name="instrumentoNumero" />
          <Campo label="Observações" name="observacoes" colSpan={2} />
          {state?.erro && <div className="col-span-3 text-xs text-red-700">{state.erro}</div>}
          {state?.ok && <div className="col-span-3 text-xs text-emerald-700">Reajuste registrado.</div>}
          <button type="submit" className="col-span-3 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            Salvar reajuste
          </button>
        </form>
      </details>
    </div>
  );
}

function Campo({
  label,
  colSpan = 1,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; colSpan?: 1 | 2 | 3 }) {
  const cls = colSpan === 1 ? "col-span-1" : colSpan === 2 ? "col-span-2" : "col-span-3";
  return (
    <label className={`flex flex-col gap-1 ${cls}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded border border-slate-300 px-2 py-1 text-xs" />
    </label>
  );
}

function Sel({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select {...props} className="rounded border border-slate-300 px-2 py-1 text-xs">
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
