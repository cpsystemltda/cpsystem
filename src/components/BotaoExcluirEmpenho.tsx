"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { excluirEmpenhoAction } from "@/app/actions/contratacoes";

// Botao de excluir Empenho/Fornecimento/Execucao com confirmacao inline.
// Mesma UX do BotaoExcluirAta/BotaoExcluirContrato. A action
// `excluirEmpenhoAction` impede a exclusao se o empenho ja estiver PAGO.
export function BotaoExcluirEmpenho({ empenhoId }: { empenhoId: string }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50"
        title="Excluir definitivamente"
      >
        <Trash2 className="h-3.5 w-3.5" /> Excluir
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50/70 px-3 py-1.5">
      <span className="text-xs text-red-800">
        <strong>Confirma a exclusão?</strong> Não pode ser desfeita.
      </span>
      <form action={excluirEmpenhoAction}>
        <input type="hidden" name="id" value={empenhoId} />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
        >
          <Trash2 className="h-3 w-3" /> Excluir definitivamente
        </button>
      </form>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-full p-1 text-slate-500 hover:bg-white"
        title="Cancelar"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
