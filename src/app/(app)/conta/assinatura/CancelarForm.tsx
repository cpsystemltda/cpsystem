"use client";

import { useActionState } from "react";
import { cancelarAssinaturaAction } from "@/app/actions/assinatura";

export function CancelarAssinaturaForm() {
  const [state, formAction] = useActionState(cancelarAssinaturaAction, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Confirma o cancelamento da assinatura?")) e.preventDefault();
      }}
      className="mt-3"
    >
      <button
        type="submit"
        className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Cancelar assinatura
      </button>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
    </form>
  );
}
