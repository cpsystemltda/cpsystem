"use client";

import { useActionState, useState } from "react";
import { salvarPreferenciaWhatsAppAction } from "@/app/actions/whatsapp";

export function PreferenciasWhatsAppForm({
  telefone,
  optIn,
}: {
  telefone: string;
  optIn: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    salvarPreferenciaWhatsAppAction,
    null,
  );
  const [optInLocal, setOptInLocal] = useState(optIn);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div>
        <label
          className="mb-1 block text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.12em", color: "var(--text-soft)" }}
        >
          Seu WhatsApp (com DDD)
        </label>
        <input
          type="tel"
          name="telefone"
          defaultValue={telefone}
          placeholder="(11) 99999-9999"
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "0.5px solid var(--hairline)",
            color: "var(--text)",
          }}
        />
        <p className="mt-1 text-[10px]" style={{ color: "var(--text-mute)" }}>
          Aceita qualquer formato — o sistema normaliza.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="optInWpp"
          name="optIn"
          value="1"
          checked={optInLocal}
          onChange={(e) => setOptInLocal(e.target.checked)}
        />
        <label htmlFor="optInWpp" className="text-sm" style={{ color: "var(--text)" }}>
          Sim, quero receber notificações no WhatsApp
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full px-5 py-2 text-xs font-bold uppercase transition hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #3FA85F 0%, #2F8F4C 100%)",
            color: "#FFFFFF",
            border: "0.5px solid rgba(47,143,76,1)",
            letterSpacing: "0.14em",
          }}
        >
          {isPending ? "Salvando..." : "Salvar preferência"}
        </button>
        {state?.ok && (
          <span className="text-xs font-semibold" style={{ color: "#2F8F4C" }}>
            ✓ Salvo
          </span>
        )}
        {state?.erro && (
          <span className="text-xs font-semibold" style={{ color: "#BE123C" }}>
            {state.erro}
          </span>
        )}
      </div>
    </form>
  );
}
