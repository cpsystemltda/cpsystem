"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { atualizarPercentualAction } from "@/app/actions/vinculoAnalista";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
    </button>
  );
}

export function PercentualForm({ vinculoId, valorAtual }: { vinculoId: string; valorAtual: number }) {
  const [state, formAction] = useActionState(atualizarPercentualAction, null);
  const [v, setV] = useState(String(valorAtual));

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="vinculoId" value={vinculoId} />
      <input
        type="number"
        step="0.1"
        min="0"
        max="100"
        name="percentualComissao"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-xs"
      />
      <span className="text-xs text-slate-500">%</span>
      <Botao />
      {state?.erro && <span className="ml-1 text-[10px] text-red-600">{state.erro}</span>}
      {state?.ok && <span className="ml-1 text-[10px] text-emerald-700">salvo</span>}
    </form>
  );
}
