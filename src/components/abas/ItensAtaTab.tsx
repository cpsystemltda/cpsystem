"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import { LerMais } from "@/components/LerMais";
import {
  atualizarAtaItemAction,
  removerAtaItemAction,
} from "@/app/actions/orgaos";

type ItemSaldo = {
  ataItemId: string;
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

export function ItensAtaTab({
  saldo,
}: {
  saldo: { itens: ItemSaldo[] };
}) {
  if (saldo.itens.length === 0) {
    return (
      <div
        className="glass-tile rounded-[20px] p-12 text-center"
        style={{ border: "0.5px dashed var(--hairline)" }}
      >
        <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
          Esta Ata não tem itens registrados.
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-soft)" }}>
          Os itens são gravados na criação da Ata. Se a Ata foi cadastrada antes desse
          campo ficar disponível, a forma mais rápida é{" "}
          <Link
            href="/contratacoes/nova/ata"
            className="font-bold underline"
            style={{ color: "var(--primary-deep)" }}
          >
            cadastrar uma nova Ata
          </Link>{" "}
          incluindo os itens registrados.
        </p>
      </div>
    );
  }

  // Agrupa por lote — mantém ordem natural (numérico quando possível)
  const grupos = new Map<string, ItemSaldo[]>();
  const ITENS_ISOLADOS = "__isolados__";
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
          <section key={chave} className="glass overflow-hidden rounded-[20px]">
            <header
              className="flex items-center justify-between gap-3 px-6 py-3"
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
                <h3
                  className="text-[14px] font-extrabold"
                  style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
                >
                  {tituloGrupo}
                </h3>
                <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                  {itens.length} item{itens.length !== 1 ? "ns" : ""} · {subtotalQtd} unidade
                  {subtotalQtd !== 1 ? "s" : ""} · {brl(subtotalDisp)} disponível
                </span>
              </div>
            </header>
            <div style={{ overflowX: "auto" }}>
            <table
              className="table-glass"
              style={{ minWidth: "1240px", tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: "64px" }} />
                <col style={{ width: "auto", minWidth: "320px" }} />
                <col style={{ width: "64px" }} />
                <col style={{ width: "104px" }} />
                <col style={{ width: "104px" }} />
                <col style={{ width: "112px" }} />
                <col style={{ width: "108px" }} />
                <col style={{ width: "128px" }} />
                <col style={{ width: "80px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="center">Item</th>
                  <th>Descrição</th>
                  <th>Un.</th>
                  <th className="num">Qtd. registrada</th>
                  <th className="num">Qtd. usada</th>
                  <th className="num">Qtd. disponível</th>
                  <th className="num">Valor unit.</th>
                  <th className="num">Valor disponível</th>
                  <th className="center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <LinhaItem key={it.ataItemId} item={it} />
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
  const [state, formAction] = useActionState(atualizarAtaItemAction, null);
  const usado = it.quantidadeUsada > 0;
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <tr style={{ background: "rgba(255,205,80,0.10)" }}>
        <td colSpan={9} className="p-3">
          <form action={formAction} className="grid grid-cols-8 gap-2 text-xs">
            <input type="hidden" name="id" value={it.ataItemId} />
            <label className="col-span-1 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Lote</span>
              <input
                name="lote"
                defaultValue={it.lote ?? ""}
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            <label className="col-span-1 flex flex-col gap-1">
              <span className="font-bold text-slate-500">Item</span>
              <input
                name="numero"
                defaultValue={it.numero ?? ""}
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
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
              <input name="marca" className="rounded border border-slate-300 px-2 py-1" />
            </label>
            {usado && (
              <div className="col-span-8 rounded bg-amber-100 px-2 py-1.5 text-amber-900">
                Atenção: este item já tem quantidade utilizada por Contratos/Empenhos.
                Reduzir a quantidade abaixo do já consumido pode quebrar o saldo —
                confira antes de salvar.
              </div>
            )}
            {state?.erro && (
              <div className="col-span-8 text-red-700">{state.erro}</div>
            )}
            <div className="col-span-8 flex gap-2 pt-1">
              <button
                type="submit"
                className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white"
                onClick={(ev) => {
                  if (
                    !window.confirm(
                      "Tem certeza? Esta ação será registrada no histórico (alterar valores monetários ou quantidades é uma alteração sensível).",
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
    <tr>
      <td className="center" style={{ verticalAlign: "top" }}>
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
      <td
        className="strong"
        title={it.descricao}
        style={{ whiteSpace: "normal", wordBreak: "break-word", verticalAlign: "top" }}
      >
        <LerMais texto={it.descricao} limite={140} />
      </td>
      <td>{it.unidade}</td>
      <td className="num">{it.quantidadeTotal}</td>
      <td className="num">{it.quantidadeUsada}</td>
      <td className="num">
        <span
          style={{
            fontWeight: 700,
            color:
              it.quantidadeDisponivel === 0 ? "var(--coral-deep)" : "var(--mint-deep)",
          }}
        >
          {it.quantidadeDisponivel}
        </span>
      </td>
      <td className="num">{brl(it.valorUnitario)}</td>
      <td className="num strong">{brl(it.valorDisponivel)}</td>
      <td className="center">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title="Editar item"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <form action={removerAtaItemAction}>
            <input type="hidden" name="id" value={it.ataItemId} />
            <button
              type="submit"
              className="rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                usado
                  ? "Não pode remover — há Contrato/Empenho vinculado"
                  : "Remover item"
              }
              disabled={usado}
              onClick={(ev) => {
                if (
                  !window.confirm(
                    `Remover o item "${it.descricao.slice(
                      0,
                      80,
                    )}"? Esta ação será registrada no histórico.`,
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
