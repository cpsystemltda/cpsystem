"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { solicitarExclusaoContaAction, type ResultadoLgpd } from "@/app/actions/lgpd";

export function PedirExclusaoForm() {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, pendente] = useActionState<ResultadoLgpd | null, FormData>(
    solicitarExclusaoContaAction,
    null,
  );

  if (estado?.ok) {
    return (
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.mensagem}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
      >
        Pedir o apagamento dos meus dados
      </button>
    );
  }

  return (
    <form action={acao} className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
      <label className="block text-sm font-medium text-slate-700">
        Por que você quer apagar? <span className="font-normal text-slate-500">(opcional)</span>
        <textarea
          name="motivo"
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          placeholder="Ajuda a gente a melhorar — e às vezes dá pra resolver sem apagar nada."
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Escreva <strong>EXCLUIR</strong> para confirmar
        <input
          name="confirmacao"
          required
          autoComplete="off"
          className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
        />
      </label>
      {estado?.erro && (
        <p className="flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {estado.erro}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pendente}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar pedido
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
