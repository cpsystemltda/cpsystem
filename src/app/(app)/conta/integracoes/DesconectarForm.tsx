"use client";

import { useActionState } from "react";
import { desconectarGoogleAction } from "@/app/actions/googleCalendar";

export function DesconectarGoogleForm() {
  const [state, formAction, isPending] = useActionState(desconectarGoogleAction, null);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg px-3 py-1.5 text-xs font-bold transition hover:opacity-80 disabled:opacity-50"
        style={{
          background: "rgba(225,29,72,0.9)",
          color: "#FFFFFF",
          border: "0.5px solid rgba(190,18,60,1)",
        }}
        onClick={(e) => {
          if (!confirm("Desconectar Google Agenda? Eventos já criados permanecem na sua agenda.")) {
            e.preventDefault();
          }
        }}
      >
        {isPending ? "Desconectando..." : "Desconectar"}
      </button>
      {state?.erro && (
        <p className="mt-1 text-[10px]" style={{ color: "#BE123C" }}>
          {state.erro}
        </p>
      )}
    </form>
  );
}
