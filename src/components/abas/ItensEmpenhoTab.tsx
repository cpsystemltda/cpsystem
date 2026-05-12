"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  atualizarEmpenhoItemAction,
  removerEmpenhoItemAction,
} from "@/app/actions/orgaos";

type EmpenhoItem = {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
  valorTotal: number;
  moeda: string;
};

export function ItensEmpenhoTab({
  itens,
  empenhoEditavel,
}: {
  itens: EmpenhoItem[];
  empenhoEditavel: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Descrição</th>
            <th className="px-4 py-2 text-left">Un.</th>
            <th className="px-4 py-2 text-right">Qtd.</th>
            <th className="px-4 py-2 text-left">Moeda</th>
            <th className="px-4 py-2 text-right">Valor unit.</th>
            <th className="px-4 py-2 text-right">Total</th>
            {empenhoEditavel && <th className="px-4 py-2 text-center">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {itens.map((it) => (
            <LinhaItem key={it.id} item={it} editavel={empenhoEditavel} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaItem({ item: it, editavel }: { item: EmpenhoItem; editavel: boolean }) {
  const [editando, setEditando] = useState(false);
  const [state, formAction] = useActionState(atualizarEmpenhoItemAction, null);
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <tr className="border-t border-slate-100" style={{ background: "rgba(255,205,80,0.10)" }}>
        <td colSpan={7} className="p-3">
          <form action={formAction} className="grid grid-cols-6 gap-2 text-xs">
            <input type="hidden" name="id" value={it.id} />
            <label className="col-span-3 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Descrição *</span>
              <textarea
                name="descricao"
                defaultValue={it.descricao}
                required
                rows={2}
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="col-span-1 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Un. *</span>
              <input
                name="unidade"
                defaultValue={it.unidade}
                required
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="col-span-1 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Qtd. *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="quantidade"
                defaultValue={it.quantidade}
                required
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="col-span-1 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Valor unit. *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="valorUnitario"
                defaultValue={it.valorUnitario}
                required
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Marca</span>
              <input
                name="marca"
                defaultValue={it.marca ?? ""}
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            {state?.erro && (
              <div className="col-span-6 text-red-700">{state.erro}</div>
            )}
            <div className="col-span-6 flex gap-2 pt-1">
              <button
                type="submit"
                className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white"
                onClick={(ev) => {
                  if (
                    !window.confirm(
                      "Tem certeza? Esta ação será registrada no histórico.",
                    )
                  ) {
                    ev.preventDefault();
                  }
                }}
              >
                Salvar alterações
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5"
              >
                <X className="h-3 w-3" /> Cancelar
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2">{it.descricao}</td>
      <td className="px-4 py-2 text-slate-600">{it.unidade}</td>
      <td className="px-4 py-2 text-right">{it.quantidade}</td>
      <td className="px-4 py-2 text-xs text-slate-500">{it.moeda}</td>
      <td className="px-4 py-2 text-right text-slate-600">{brl(it.valorUnitario)}</td>
      <td className="px-4 py-2 text-right font-medium">{brl(it.valorTotal)}</td>
      {editavel && (
        <td className="px-4 py-2 text-center">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Editar item"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <form action={removerEmpenhoItemAction}>
              <input type="hidden" name="id" value={it.id} />
              <button
                type="submit"
                className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                title="Remover item"
                onClick={(ev) => {
                  if (
                    !window.confirm(
                      `Remover o item "${it.descricao.slice(0, 80)}"? Esta ação será registrada no histórico.`,
                    )
                  ) {
                    ev.preventDefault();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </td>
      )}
    </tr>
  );
}
