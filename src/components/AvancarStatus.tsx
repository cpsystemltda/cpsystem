"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import { Check, FileText, Paperclip } from "lucide-react";
import { registrarMarcoAction } from "@/app/actions/contratacoes";

type Props = {
  empenhoId: string;
  marco: string;
  /** Data já registrada (etapa concluída) */
  ja?: Date | null;
  /** URL do arquivo já enviado */
  jaArquivo?: string | null;
  /** Etapa anterior ainda não concluída → bloqueia */
  bloqueado?: boolean;
};

export function AvancarStatus({ empenhoId, marco, ja, jaArquivo, bloqueado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction] = useActionState(registrarMarcoAction, null);

  useEffect(() => {
    if (state?.ok) setAberto(false);
  }, [state?.ok]);

  // ── Etapa concluída ──────────────────────────────────────
  if (ja) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          {ja.toLocaleDateString("pt-BR")}
        </span>
        {jaArquivo && (
          <a
            href={jaArquivo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <FileText className="h-3.5 w-3.5" /> Arquivo
          </a>
        )}
      </div>
    );
  }

  // ── Etapa bloqueada (anterior não concluída) ─────────────
  if (bloqueado) {
    return <span className="text-xs text-slate-400">Aguardando etapa anterior</span>;
  }

  // ── Etapa disponível para registrar ─────────────────────
  return (
    <div>
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition"
        >
          <div className="h-4 w-4 rounded border-2 border-slate-400 group-hover:border-blue-500" />
          Registrar data
        </button>
      ) : (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <input type="hidden" name="marco" value={marco} />

          <div className="flex items-center gap-2">
            <input
              type="date"
              name="data"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Check className="h-3 w-3" /> Confirmar
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            <Paperclip className="h-3.5 w-3.5" />
            <span>Anexar arquivo (opcional)</span>
            <input
              type="file"
              name="arquivo"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const label = e.target.parentElement?.querySelector("span");
                if (label) label.textContent = e.target.files?.[0]?.name ?? "Anexar arquivo (opcional)";
              }}
            />
          </label>

          {state?.erro && (
            <p className="text-xs text-red-600">{state.erro}</p>
          )}
        </form>
      )}
    </div>
  );
}
