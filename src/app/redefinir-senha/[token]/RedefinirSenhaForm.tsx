"use client";

import { useActionState } from "react";
import { salvarNovaSenhaAction } from "@/app/actions/senhaReset";

export function RedefinirSenhaForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(salvarNovaSenhaAction, null);
  const e = state?.campos ?? {};

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />

      <label className="block text-xs font-semibold text-slate-700">
        Nova senha
        <input
          name="senha"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
          placeholder="Mínimo 6 caracteres"
        />
        {e.senha && <p className="mt-1 text-[11px] font-semibold text-rose-700">{e.senha}</p>}
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Confirmar nova senha
        <input
          name="confirmacaoSenha"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
        />
        {e.confirmacaoSenha && (
          <p className="mt-1 text-[11px] font-semibold text-rose-700">{e.confirmacaoSenha}</p>
        )}
      </label>

      {state?.erro && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{state.erro}</div>
      )}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-[12px] font-bold uppercase transition hover:scale-[1.02]"
        style={{
          background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
          color: "#0A0A0A",
          letterSpacing: "0.18em",
        }}
      >
        Salvar nova senha e entrar
      </button>

      <p className="text-[11px] text-slate-500">
        Ao salvar, você entra logado direto. Todas as sessões anteriores são encerradas por segurança.
      </p>
    </form>
  );
}
