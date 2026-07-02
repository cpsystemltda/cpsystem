"use client";

import { useActionState } from "react";
import { enviarTesteWhatsAppAction, enviarSelfNotificacaoAction } from "@/app/actions/whatsapp";

export function TesteWhatsAppPanel() {
  const [state, formAction, isPending] = useActionState(enviarTesteWhatsAppAction, null);
  const [selfState, selfAction, selfPending] = useActionState(
    enviarSelfNotificacaoAction,
    null,
  );

  return (
    <section
      className="mt-8 rounded-2xl px-6 py-6"
      style={{
        border: "0.5px solid rgba(212,175,55,0.4)",
        background: "rgba(212,175,55,0.06)",
      }}
    >
      <header className="mb-3">
        <span
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.14em", color: "var(--primary-deep)" }}
        >
          Painel super admin — teste de envio
        </span>
        <h3 className="mt-1 text-sm font-extrabold" style={{ color: "var(--text)" }}>
          Disparar mensagem de teste
        </h3>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-soft)" }}>
          Bypassa opt-in. Use pra validar formato antes de liberar pros clientes.
        </p>
      </header>

      <form action={formAction} className="space-y-2">
        <input
          type="tel"
          name="telefone"
          placeholder="(21) 99720-9623"
          required
          className="w-full rounded-xl px-4 py-2.5 text-sm"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "0.5px solid var(--hairline)",
            color: "var(--text)",
          }}
        />
        <textarea
          name="mensagem"
          placeholder="Mensagem de teste — quebre linhas com Enter."
          rows={4}
          required
          className="w-full rounded-xl px-4 py-2.5 text-sm"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "0.5px solid var(--hairline)",
            color: "var(--text)",
            fontFamily: "inherit",
          }}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full px-5 py-2 text-xs font-bold uppercase transition hover:opacity-90 disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
              color: "#0A0A0A",
              letterSpacing: "0.14em",
            }}
          >
            {isPending ? "Enviando..." : "Enviar teste"}
          </button>
          {state?.ok && (
            <span className="text-xs font-semibold" style={{ color: "#2F8F4C" }}>
              ✓ Enviado {state.messageId ? `(${state.messageId.slice(0, 8)}...)` : ""}
            </span>
          )}
          {state?.erro && (
            <span className="text-xs font-semibold" style={{ color: "#BE123C" }}>
              {state.erro}
            </span>
          )}
        </div>
      </form>

      <hr className="my-5" style={{ borderColor: "var(--hairline)" }} />

      <div>
        <h4 className="text-xs font-extrabold" style={{ color: "var(--text)" }}>
          Testar pipeline end-to-end (envio pra você mesmo)
        </h4>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-soft)" }}>
          Passa pelo mesmo fluxo dos crons: checa opt-in, grava historico, respeita
          idempotencia. Requer opt-in ligado acima e telefone salvo.
        </p>
        <form action={selfAction} className="mt-2 space-y-2">
          <textarea
            name="mensagem"
            placeholder="Mensagem que voce quer enviar pra si mesmo pra validar o fluxo completo."
            rows={3}
            required
            className="w-full rounded-xl px-4 py-2.5 text-sm"
            style={{
              background: "rgba(255,255,255,0.7)",
              border: "0.5px solid var(--hairline)",
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={selfPending}
              className="rounded-full px-5 py-2 text-xs font-bold uppercase transition hover:opacity-90 disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.7)",
                color: "var(--text)",
                border: "0.5px solid var(--hairline)",
                letterSpacing: "0.14em",
              }}
            >
              {selfPending ? "Enviando..." : "Enviar pra mim (pipeline)"}
            </button>
            {selfState?.ok && (
              <span className="text-xs font-semibold" style={{ color: "#2F8F4C" }}>
                ✓ Enviado
              </span>
            )}
            {selfState?.erro && (
              <span className="text-xs font-semibold" style={{ color: "#BE123C" }}>
                {selfState.erro}
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
