"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Check, FileText, Paperclip, Pencil } from "lucide-react";
import { registrarMarcoReajusteAction } from "@/app/actions/reajusteRetroativo";

// Variante do AvancarStatus pra marcos do ReajusteRetroativo (NF
// complementar). API idêntica — só muda a server action chamada.

type Props = {
  empenhoId: string;
  marco: string;
  ja?: Date | null;
  jaArquivo?: string | null;
  bloqueado?: boolean;
};

function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function AvancarStatusReajuste({ empenhoId, marco, ja, jaArquivo, bloqueado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [optimisticData, setOptimisticData] = useOptimistic<Date | null>(ja ?? null);

  async function handleSubmit(formData: FormData) {
    const dataStr = formData.get("data") as string;
    const dataOtimista = dataStr ? new Date(dataStr + "T12:00:00") : new Date();

    setAberto(false);
    setErro(null);

    startTransition(async () => {
      setOptimisticData(dataOtimista);
      const result = await registrarMarcoReajusteAction(null, formData);
      if (result && !result.ok) setErro(result.erro);
    });
  }

  if (optimisticData) {
    if (aberto) {
      return (
        <form action={handleSubmit} className="space-y-2">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <input type="hidden" name="marco" value={marco} />
          <div className="flex items-center gap-2">
            <input
              type="date"
              name="data"
              defaultValue={isoDateUtc(optimisticData)}
              required
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
            >
              <Check className="h-3 w-3" /> Salvar
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
            <span>{jaArquivo ? "Substituir arquivo (opcional)" : "Anexar arquivo (opcional)"}</span>
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
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </form>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isPending ? "text-emerald-400" : "text-emerald-700"}`}>
          <Check className="h-3.5 w-3.5" />
          {optimisticData.toLocaleDateString("pt-BR")}
          {isPending && <span className="ml-1 text-[10px] text-slate-400">salvando…</span>}
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
        <button
          type="button"
          onClick={() => { setErro(null); setAberto(true); }}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <Pencil className="h-3 w-3" /> Editar
        </button>
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    );
  }

  if (bloqueado) {
    return <span className="text-xs text-slate-400">Aguardando etapa anterior</span>;
  }

  return (
    <div>
      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 transition"
        >
          <div className="h-4 w-4 rounded border-2 border-slate-400" />
          Registrar data
        </button>
      ) : (
        <form action={handleSubmit} className="space-y-2">
          <input type="hidden" name="empenhoId" value={empenhoId} />
          <input type="hidden" name="marco" value={marco} />

          <div className="flex items-center gap-2">
            <input
              type="date"
              name="data"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-100 outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
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

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </form>
      )}
    </div>
  );
}
