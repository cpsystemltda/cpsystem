"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Check } from "lucide-react";
import { marcarComissaoExecucaoAction } from "@/app/actions/comissaoExecucao";

export function ConfirmarRecebimentoForm({ comissaoId }: { comissaoId: string }) {
  const [state, formAction] = useActionState(marcarComissaoExecucaoAction, null);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={comissaoId} />
      <input type="hidden" name="status" value="PAGO" />
      <Botao />
      {state?.erro && <p className="mt-1 text-[10px] text-rose-600">{state.erro}</p>}
    </form>
  );
}

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="inline h-3 w-3 animate-spin" />
      ) : (
        <Check className="inline h-3 w-3 mr-1" />
      )}
      Confirmar recebimento
    </button>
  );
}
