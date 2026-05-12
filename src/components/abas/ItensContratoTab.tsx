"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import {
  atualizarContratoItemAction,
  removerContratoItemAction,
} from "@/app/actions/orgaos";

type ItemSaldo = {
  contratoItemId: string;
  descricao: string;
  unidade: string;
  quantidadeTotal: number;
  quantidadeUsada: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
  valorDisponivel: number;
};

export function ItensContratoTab({
  saldo,
}: {
  saldo: { itens: ItemSaldo[] };
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Descrição</th>
            <th className="px-4 py-2 text-left">Un.</th>
            <th className="px-4 py-2 text-right">Qtd. contratada</th>
            <th className="px-4 py-2 text-right">Qtd. executada</th>
            <th className="px-4 py-2 text-right">Qtd. a executar</th>
            <th className="px-4 py-2 text-right">Valor a executar</th>
            <th className="px-4 py-2 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {saldo.itens.map((it) => (
            <LinhaItem key={it.contratoItemId} item={it} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaItem({ item: it }: { item: ItemSaldo }) {
  const [editando, setEditando] = useState(false);
  const [state, formAction] = useActionState(atualizarContratoItemAction, null);
  const usado = it.quantidadeUsada > 0;
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <tr className="border-t border-slate-100" style={{ background: "rgba(255,205,80,0.10)" }}>
        <td colSpan={7} className="p-3">
          <form action={formAction} className="grid grid-cols-6 gap-2 text-xs">
            <input type="hidden" name="id" value={it.contratoItemId} />
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
                defaultValue={it.quantidadeTotal}
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
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            {usado && (
              <div className="col-span-6 rounded bg-amber-100 px-2 py-1.5 text-amber-900">
                Atenção: este item já tem quantidade executada por Empenhos.
                Reduzir abaixo do já consumido pode quebrar o saldo.
              </div>
            )}
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
      <td className="px-4 py-2 text-right">{it.quantidadeTotal}</td>
      <td className="px-4 py-2 text-right text-slate-600">{it.quantidadeUsada}</td>
      <td className="px-4 py-2 text-right">
        <span
          className={
            it.quantidadeDisponivel === 0
              ? "text-red-600 font-medium"
              : "text-emerald-700 font-medium"
          }
        >
          {it.quantidadeDisponivel}
        </span>
      </td>
      <td className="px-4 py-2 text-right font-medium">{brl(it.valorDisponivel)}</td>
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
          <form action={removerContratoItemAction}>
            <input type="hidden" name="id" value={it.contratoItemId} />
            <button
              type="submit"
              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              title={usado ? "Não pode remover — já há execução" : "Remover item"}
              disabled={usado}
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
    </tr>
  );
}
