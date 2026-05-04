"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { brl } from "@/lib/validators";

export type AtaItemRef = {
  id: string;
  descricao: string;
  unidade: string;
  quantidadeDisponivel: number;
  valorUnitario: number;
};

export type LinhaItem = {
  descricao: string;
  unidade: string;
  quantidade: string;
  marca: string;
  valorUnitario: string;
  ataItemId: string;
};

const VAZIA: LinhaItem = { descricao: "", unidade: "", quantidade: "", marca: "", valorUnitario: "", ataItemId: "" };

export type ItemInicial = {
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
};

export function ItensEditor({
  ataItens,
  itensIniciais,
}: {
  ataItens?: AtaItemRef[];
  itensIniciais?: ItemInicial[];
}) {
  const inicial: LinhaItem[] =
    itensIniciais && itensIniciais.length > 0
      ? itensIniciais.map((i) => ({
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: String(i.quantidade),
          marca: i.marca ?? "",
          valorUnitario: String(i.valorUnitario),
          ataItemId: "",
        }))
      : [{ ...VAZIA }];
  const [linhas, setLinhas] = useState<LinhaItem[]>(inicial);

  function add() {
    setLinhas((l) => [...l, { ...VAZIA }]);
  }

  function rm(idx: number) {
    setLinhas((l) => (l.length === 1 ? l : l.filter((_, i) => i !== idx)));
  }

  function update(idx: number, patch: Partial<LinhaItem>) {
    setLinhas((l) => l.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function pickAtaItem(idx: number, ataItemId: string) {
    if (!ataItens) return;
    const ref = ataItens.find((a) => a.id === ataItemId);
    if (!ref) {
      update(idx, { ataItemId: "" });
      return;
    }
    update(idx, {
      ataItemId,
      descricao: ref.descricao,
      unidade: ref.unidade,
      valorUnitario: String(ref.valorUnitario),
    });
  }

  const totalLinha = (l: LinhaItem) => (Number(l.quantidade) || 0) * (Number(l.valorUnitario) || 0);
  const total = linhas.reduce((s, l) => s + totalLinha(l), 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {ataItens && <th className="px-3 py-2 text-left">Item da Ata</th>}
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Un.</th>
              <th className="px-3 py-2 text-right">Qtd.</th>
              <th className="px-3 py-2 text-left">Marca</th>
              <th className="px-3 py-2 text-right">Valor unit.</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => (
              <tr key={idx} className="border-t border-slate-100">
                {ataItens && (
                  <td className="px-3 py-2">
                    <select
                      name={`itens[${idx}][ataItemId]`}
                      value={l.ataItemId}
                      onChange={(e) => pickAtaItem(idx, e.target.value)}
                      className="w-44 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">— Livre —</option>
                      {ataItens.map((a) => (
                        <option key={a.id} value={a.id} disabled={a.quantidadeDisponivel <= 0}>
                          {a.descricao.slice(0, 30)}
                          {a.descricao.length > 30 ? "…" : ""} ({a.quantidadeDisponivel} {a.unidade})
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-3 py-2">
                  <input
                    name={`itens[${idx}][descricao]`}
                    value={l.descricao}
                    onChange={(e) => update(idx, { descricao: e.target.value })}
                    required
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    name={`itens[${idx}][unidade]`}
                    value={l.unidade}
                    onChange={(e) => update(idx, { unidade: e.target.value })}
                    required
                    className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="UN"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={`itens[${idx}][quantidade]`}
                    value={l.quantidade}
                    onChange={(e) => update(idx, { quantidade: e.target.value })}
                    required
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    name={`itens[${idx}][marca]`}
                    value={l.marca}
                    onChange={(e) => update(idx, { marca: e.target.value })}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={`itens[${idx}][valorUnitario]`}
                    value={l.valorUnitario}
                    onChange={(e) => update(idx, { valorUnitario: e.target.value })}
                    required
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-right text-xs font-medium text-slate-700">
                  {brl(totalLinha(l))}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => rm(idx)}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    disabled={linhas.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={ataItens ? 6 : 5} className="px-3 py-2 text-right text-xs font-medium text-slate-500">
                Total geral
              </td>
              <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">{brl(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar item
      </button>
    </div>
  );
}
