"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { avancarStatusAction } from "@/app/actions/contratacoes";

export function AvancarStatus({ empenhoId, marco, ja }: { empenhoId: string; marco: string; ja?: Date | null }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (ja) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
        <Check className="h-3.5 w-3.5" /> {ja.toLocaleDateString("pt-BR")}
      </span>
    );
  }

  return (
    <form
      action={() => {
        setErro(null);
        startTransition(async () => {
          try {
            await avancarStatusAction(empenhoId, marco, data);
          } catch (err) {
            setErro(err instanceof Error ? err.message : "Erro");
          }
        });
      }}
      className="flex items-center gap-2"
    >
      <input
        type="date"
        value={data}
        onChange={(ev) => setData(ev.target.value)}
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Marcar
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </form>
  );
}
