"use client";

import { useActionState, useState } from "react";
import { verificar2FALoginAction } from "@/app/actions/doisFatores";

export function TwoFactorLoginForm() {
  const [state, action, pending] = useActionState(verificar2FALoginAction, null);
  const [modoRecovery, setModoRecovery] = useState(false);

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="tipo" value={modoRecovery ? "recovery" : "totp"} />

      {!modoRecovery ? (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Código do app</span>
            <input
              type="text"
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-center font-mono text-2xl tracking-widest text-slate-900"
            />
          </label>
          <p className="text-xs text-slate-500">
            Abra o Google Authenticator (ou o app que você configurou) e digite o código que
            aparece pra CP System.
          </p>
        </>
      ) : (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Código de recuperação</span>
            <input
              type="text"
              name="codigo"
              autoComplete="off"
              maxLength={11}
              required
              autoFocus
              placeholder="XXXXX-XXXXX"
              className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-center font-mono text-lg tracking-widest text-slate-900"
            />
          </label>
          <p className="text-xs text-slate-500">
            Use um dos códigos que você salvou quando ativou o 2FA. Cada código só funciona 1 vez.
          </p>
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Verificando…" : "Continuar"}
      </button>

      {state?.erro ? (
        <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{state.erro}</p>
      ) : null}

      <button
        type="button"
        onClick={() => setModoRecovery(!modoRecovery)}
        className="mt-2 block w-full text-center text-xs text-slate-600 hover:text-slate-900"
      >
        {modoRecovery
          ? "← Voltar pra código do app"
          : "Perdi o celular — usar código de recuperação"}
      </button>

      <a
        href="/login"
        className="block text-center text-xs text-slate-400 hover:text-slate-600"
      >
        Cancelar e voltar pro login
      </a>
    </form>
  );
}
