"use client";

import { useActionState, useRef } from "react";
import { uploadExtratoAction } from "@/app/actions/conciliacao";

export function UploadDropzone() {
  const [state, action, pending] = useActionState(uploadExtratoAction, null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <input
        ref={inputRef}
        name="arquivo"
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0] && e.target.form) {
            e.target.form.requestSubmit();
          }
        }}
      />
      <div className="text-sm text-slate-700">
        📄 Selecione o PDF do extrato bancário (até 20 MB)
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="mt-3 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Processando…" : "Escolher arquivo"}
      </button>
      <p className="mt-3 text-xs text-slate-500">
        A extração leva ~30 segundos após o upload. O resultado aparece abaixo automaticamente.
      </p>
      {state?.erro ? (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{state.erro}</p>
      ) : null}
      {state?.ok ? (
        <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {state.jaProcessado ? "Este PDF já foi processado antes." : "PDF processado! Veja a conciliação abaixo."}
        </p>
      ) : null}
    </form>
  );
}
