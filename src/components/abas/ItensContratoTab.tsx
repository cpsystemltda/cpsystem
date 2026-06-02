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
  lote: string | null;
  numero: string | null;
  quantidadeTotal: number;
  quantidadeUsada: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
  valorDisponivel: number;
};

// Agrupa por lote (lote=null vira 'Itens isolados'). Mesma logica do
// ItensAtaTab. Igor 02/06 reportou que os lotes 1 e 2 nao apareciam
// na tela principal do contrato 18/2025.
export function ItensContratoTab({
  saldo,
}: {
  saldo: { itens: ItemSaldo[] };
}) {
  if (saldo.itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Nenhum item cadastrado neste contrato.
      </div>
    );
  }

  const ITENS_ISOLADOS = "__isolados__";
  const grupos = new Map<string, ItemSaldo[]>();
  for (const it of saldo.itens) {
    const chave = it.lote && it.lote.trim() ? it.lote.trim() : ITENS_ISOLADOS;
    const arr = grupos.get(chave) ?? [];
    arr.push(it);
    grupos.set(chave, arr);
  }
  const chavesOrdenadas = Array.from(grupos.keys())
    .filter((k) => k !== ITENS_ISOLADOS)
    .sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, "pt-BR", { numeric: true });
    });
  if (grupos.has(ITENS_ISOLADOS)) chavesOrdenadas.push(ITENS_ISOLADOS);

  return (
    <div className="space-y-5">
      {chavesOrdenadas.map((chave) => {
        const itens = grupos.get(chave) ?? [];
        const tituloGrupo = chave === ITENS_ISOLADOS ? "Itens isolados" : `Lote ${chave}`;
        const subtotalQtd = itens.reduce((s, it) => s + it.quantidadeTotal, 0);
        const subtotalDisp = itens.reduce((s, it) => s + it.valorDisponivel, 0);
        return (
          <section key={chave} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <header
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderBottom: "0.5px solid var(--hairline)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-extrabold"
                  style={{
                    background:
                      chave === ITENS_ISOLADOS
                        ? "rgba(15,14,12,0.06)"
                        : "rgba(212,175,55,0.18)",
                    border:
                      chave === ITENS_ISOLADOS
                        ? "0.5px solid var(--hairline)"
                        : "0.5px solid rgba(168,137,71,0.5)",
                    color:
                      chave === ITENS_ISOLADOS ? "var(--text-mute)" : "var(--primary-deep)",
                  }}
                >
                  {chave === ITENS_ISOLADOS ? "—" : chave}
                </span>
                <h3 className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
                  {tituloGrupo}
                </h3>
                <span className="text-xs text-slate-500">
                  {itens.length} item{itens.length !== 1 ? "ns" : ""} · {subtotalQtd} unidade
                  {subtotalQtd !== 1 ? "s" : ""} · {brl(subtotalDisp)} disponível
                </span>
              </div>
            </header>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-center" style={{ width: 60 }}>Item</th>
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
                  {itens.map((it) => (
                    <LinhaItem key={it.contratoItemId} item={it} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
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
        <td colSpan={8} className="p-3">
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
      <td className="px-3 py-2 text-center">
        <span
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular"
          style={{
            background: it.numero ? "rgba(15,14,12,0.06)" : "transparent",
            color: it.numero ? "var(--text)" : "var(--text-mute)",
            border: it.numero ? "0.5px solid var(--hairline)" : "none",
          }}
        >
          {it.numero ?? "—"}
        </span>
      </td>
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
