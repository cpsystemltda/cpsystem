"use client";

import { useActionState } from "react";
import { Loader2, Play } from "lucide-react";
import { useFormStatus } from "react-dom";
import { executarReguaCobrancaAction } from "@/app/actions/assinatura";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      Executar régua agora
    </button>
  );
}

export function ReguaCobrancaButton() {
  const [state, formAction] = useActionState(executarReguaCobrancaAction, null);
  return (
    <form action={formAction}>
      <Botao />
      {state?.ok && <p className="mt-2 text-xs text-emerald-700">Régua executada.</p>}
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
    </form>
  );
}
