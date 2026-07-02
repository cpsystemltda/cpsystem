"use client";

import { useActionState } from "react";
import { concluirOnboardingAction } from "@/app/actions/onboarding";

export function ConcluirButton() {
  const [state, formAction, isPending] = useActionState(concluirOnboardingAction, null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[13px] font-bold uppercase transition hover:scale-[1.02] disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #3FA85F 0%, #2F8F4C 100%)",
          color: "#FFFFFF",
          letterSpacing: "0.18em",
        }}
      >
        {isPending ? "Liberando..." : "✓ Acessar o sistema"}
      </button>
      {state?.erro && (
        <span className="text-xs font-semibold" style={{ color: "#BE123C" }}>{state.erro}</span>
      )}
    </form>
  );
}
