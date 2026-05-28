"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { excluirContratoAction } from "@/app/actions/contratacoes";

// Botão de excluir Contrato com confirmação inline. Mesma UX do
// BotaoExcluirAta. A action `excluirContratoAction` impede a exclusão
// se houver empenhos vinculados; nesse caso a mensagem de erro vem do
// servidor. Decisão Regina (28/05): padrão é "Excluir só no lado de
// dentro" (página de detalhe), não no card da listagem.
export function BotaoExcluirContrato({ contratoId }: { contratoId: string }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:border-red-300 hover:bg-red-50"
        style={{ height: "36px" }}
        title="Excluir este contrato definitivamente"
      >
        <Trash2 className="h-3.5 w-3.5" /> Excluir
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-red-300 bg-red-50/70 px-3 py-1.5">
      <span className="text-xs text-red-800">
        <strong>Confirma a exclusão?</strong> Não pode ser desfeita.
      </span>
      <form action={excluirContratoAction}>
        <input type="hidden" name="id" value={contratoId} />
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
