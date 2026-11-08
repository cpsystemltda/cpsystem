"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { brl } from "@/lib/validators";
import { JORNADAS, sugerirColaboradoresPorPosto } from "@/lib/maoDeObra";
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
  // Mão de obra (ESP-002)
  cbo?: string | null;
  jornada?: string | null;
  unidadeMaoDeObra?: string | null;
  colaboradoresPorPosto?: number | null;
  colaboradoresNecessarios?: number;
  localPrestacao?: string | null;
};

// Agrupa por lote (lote=null vira 'Itens isolados'). Mesma logica do
// ItensAtaTab. Igor 02/06 reportou que os lotes 1 e 2 nao apareciam
// na tela principal do contrato 18/2025.
//
// ESP-002 (Igor 07/11/2026): em contrato de mão de obra a tabela vira o
// quadro de POSTOS — função, jornada, postos, colaboradores por posto,
// colaboradores necessários e valor mensal. Não existe "qtd. executada":
// o consumo é por competência (ESP-004), não por quantidade.
export function ItensContratoTab({
  saldo,
  maoDeObra = false,
}: {
  saldo: { itens: ItemSaldo[] };
  maoDeObra?: boolean;
}) {
  if (saldo.itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {maoDeObra ? "Nenhum posto cadastrado neste contrato." : "Nenhum item cadastrado neste contrato."}
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
        const tituloGrupo = chave === ITENS_ISOLADOS ? (maoDeObra ? "Postos" : "Itens isolados") : `Lote ${chave}`;
        const subtotalQtd = itens.reduce((s, it) => s + it.quantidadeTotal, 0);
        const subtotalDisp = itens.reduce((s, it) => s + it.valorDisponivel, 0);
        const subtotalMensal = itens.reduce((s, it) => s + it.quantidadeTotal * it.valorUnitario, 0);
        const subtotalColab = itens.reduce((s, it) => s + (it.colaboradoresNecessarios ?? it.quantidadeTotal), 0);
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
                  {maoDeObra
                    ? `${itens.length} funç${itens.length !== 1 ? "ões" : "ão"} · ${subtotalQtd} posto${subtotalQtd !== 1 ? "s" : ""} · ${subtotalColab} colaborador${subtotalColab !== 1 ? "es" : ""} · ${brl(subtotalMensal)} por mês`
                    : `${itens.length} item${itens.length !== 1 ? "ns" : ""} · ${subtotalQtd} unidade${subtotalQtd !== 1 ? "s" : ""} · ${brl(subtotalDisp)} disponível`}
                </span>
              </div>
            </header>
            {/* Regina cobrou desconfiguracao analoga ao ItensAtaTab —
                compacto pra caber em viewports estreitas com sidebar. */}
            <div style={{ overflowX: "auto" }}>
              {maoDeObra ? (
                <table className="w-full text-sm" style={{ minWidth: "860px", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "44px" }} />
                    <col style={{ width: "auto", minWidth: "180px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "64px" }} />
                    <col style={{ width: "72px" }} />
                    <col style={{ width: "84px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "60px" }} />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-center">Item</th>
                      <th className="px-3 py-2 text-left">Função</th>
                      <th className="px-1 py-2 text-left">Jornada</th>
                      <th className="px-1 py-2 text-left">Un.</th>
                      <th className="px-1 py-2 text-right">Qtd.</th>
                      <th className="px-1 py-2 text-right" title="Colaboradores por posto">Colab./posto</th>
                      <th className="px-1 py-2 text-right" title="Colaboradores necessários = quantidade × colaboradores por posto">Colab. nec.</th>
                      <th className="px-1 py-2 text-right">Valor mensal unit.</th>
                      <th className="px-1 py-2 text-right">Valor mensal</th>
                      <th className="px-1 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it) => (
                      <LinhaItem key={it.contratoItemId} item={it} maoDeObra />
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm" style={{ minWidth: "760px", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "44px" }} />
                    <col style={{ width: "auto", minWidth: "180px" }} />
                    <col style={{ width: "52px" }} />
                    <col style={{ width: "72px" }} />
                    <col style={{ width: "72px" }} />
                    <col style={{ width: "80px" }} />
                    {/* Regina 14/07: valor unitario visivel. */}
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "60px" }} />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-center">Item</th>
                      <th className="px-3 py-2 text-left">Descrição</th>
                      <th className="px-1 py-2 text-left">Un.</th>
                      <th className="px-1 py-2 text-right">Qtd. contr.</th>
                      <th className="px-1 py-2 text-right">Qtd. exec.</th>
                      <th className="px-1 py-2 text-right">A executar</th>
                      <th className="px-1 py-2 text-right">Valor unit.</th>
                      <th className="px-1 py-2 text-right">Valor a exec.</th>
                      <th className="px-1 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((it) => (
                      <LinhaItem key={it.contratoItemId} item={it} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function LinhaItem({ item: it, maoDeObra = false }: { item: ItemSaldo; maoDeObra?: boolean }) {
  const [editando, setEditando] = useState(false);
  const [state, formAction] = useActionState(atualizarContratoItemAction, null);
  const [jornada, setJornada] = useState(it.jornada ?? "");
  const usado = it.quantidadeUsada > 0;
  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);
  const jornadaConhecida = (JORNADAS as readonly string[]).includes(jornada);

  if (editando) {
    return (
      <tr className="border-t border-slate-100" style={{ background: "rgba(255,205,80,0.10)" }}>
        <td colSpan={maoDeObra ? 10 : 9} className="p-3">
          <form action={formAction} className="grid grid-cols-6 gap-2 text-xs">
            <input type="hidden" name="id" value={it.contratoItemId} />
            <label className="col-span-3 flex flex-col gap-1">
              <span className="font-bold text-slate-500">{maoDeObra ? "Função *" : "Descrição *"}</span>
              <textarea
                name="descricao"
                defaultValue={it.descricao}
                required
                rows={2}
                className="rounded border border-slate-300 px-2 py-1"
              />
            </label>
            {maoDeObra ? (
              <label className="col-span-1 flex flex-col gap-1">
                <span className="font-bold text-slate-500">Un. *</span>
                <select name="unidade" defaultValue={it.unidadeMaoDeObra ?? (it.unidade === "EMPREGADO" ? "EMPREGADO" : "POSTO")} className="rounded border border-slate-300 px-2 py-1">
                  <option value="POSTO">Posto</option>
                  <option value="EMPREGADO">Empregado</option>
                </select>
              </label>
            ) : (
              <label className="col-span-1 flex flex-col gap-1">
                <span className="font-bold text-slate-500">Un. *</span>
                <input
                  name="unidade"
                  defaultValue={it.unidade}
                  required
                  className="rounded border border-slate-300 px-2 py-1"
                />
              </label>
            )}
            <label className="col-span-1 flex flex-col gap-1">
              <span className="font-bold text-slate-500">{maoDeObra ? "Postos/qtd. *" : "Qtd. *"}</span>
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
              <span className="font-bold text-slate-500">{maoDeObra ? "Valor mensal unit. *" : "Valor unit. *"}</span>
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
            {maoDeObra ? (
              <>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="font-bold text-slate-500">Jornada / escala</span>
                  <select
                    name="jornadaSelect"
                    value={jornadaConhecida || !jornada ? jornada : "Outra"}
                    onChange={(ev) => setJornada(ev.target.value === "Outra" ? "Outra" : ev.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value="">—</option>
                    {JORNADAS.map((j) => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                  {(jornada === "Outra" || (jornada && !jornadaConhecida)) ? (
                    <input name="jornada" defaultValue={jornadaConhecida ? "" : jornada} placeholder="Descreva a jornada" className="rounded border border-slate-300 px-2 py-1" />
                  ) : (
                    <input type="hidden" name="jornada" value={jornada} />
                  )}
                </label>
                <label className="col-span-1 flex flex-col gap-1">
                  <span className="font-bold text-slate-500">Colab./posto</span>
                  <input
                    type="number"
                    min="1"
                    name="colaboradoresPorPosto"
                    defaultValue={it.colaboradoresPorPosto ?? sugerirColaboradoresPorPosto(it.jornada)}
                    className="rounded border border-slate-300 px-2 py-1"
                  />
                </label>
                <label className="col-span-1 flex flex-col gap-1">
                  <span className="font-bold text-slate-500">CBO</span>
                  <input name="cbo" defaultValue={it.cbo ?? ""} className="rounded border border-slate-300 px-2 py-1" />
                </label>
                <label className="col-span-2 flex flex-col gap-1">
                  <span className="font-bold text-slate-500">Local de prestação</span>
                  <input name="localPrestacao" defaultValue={it.localPrestacao ?? ""} className="rounded border border-slate-300 px-2 py-1" />
                </label>
              </>
            ) : (
              <label className="col-span-2 flex flex-col gap-1">
                <span className="font-bold text-slate-500">Marca</span>
                <input
                  name="marca"
                  className="rounded border border-slate-300 px-2 py-1"
                />
              </label>
            )}
            {usado && !maoDeObra && (
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

  const acoes = (
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
  );

  const numero = (
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
  );

  if (maoDeObra) {
    const porPosto = it.unidadeMaoDeObra === "POSTO" ? it.colaboradoresPorPosto ?? 1 : null;
    return (
      <tr className="border-t border-slate-100">
        <td className="px-2 py-2 text-center">{numero}</td>
        <td className="px-3 py-2" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
          {it.descricao}
          {it.cbo && <span className="ml-1 text-[11px] text-slate-500">CBO {it.cbo}</span>}
          {it.localPrestacao && <span className="block text-[11px] text-slate-500">{it.localPrestacao}</span>}
        </td>
        <td className="px-1 py-2 text-slate-600">{it.jornada ?? "—"}</td>
        <td className="px-1 py-2 text-slate-600">{it.unidadeMaoDeObra === "EMPREGADO" ? "Empregado" : it.unidadeMaoDeObra === "POSTO" ? "Posto" : it.unidade}</td>
        <td className="px-1 py-2 text-right">{it.quantidadeTotal}</td>
        <td className="px-1 py-2 text-right text-slate-600">{porPosto ?? "—"}</td>
        <td className="px-1 py-2 text-right font-medium">{it.colaboradoresNecessarios ?? it.quantidadeTotal}</td>
        <td className="px-1 py-2 text-right text-slate-700">{brl(it.valorUnitario)}</td>
        <td className="px-1 py-2 text-right font-medium">{brl(it.quantidadeTotal * it.valorUnitario)}</td>
        <td className="px-1 py-2 text-center">{acoes}</td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-2 py-2 text-center">{numero}</td>
      <td
        className="px-3 py-2"
        style={{ whiteSpace: "normal", wordBreak: "break-word" }}
      >
        {it.descricao}
      </td>
      <td className="px-1 py-2 text-slate-600">{it.unidade}</td>
      <td className="px-1 py-2 text-right">{it.quantidadeTotal}</td>
      <td className="px-1 py-2 text-right text-slate-600">{it.quantidadeUsada}</td>
      <td className="px-1 py-2 text-right">
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
      <td className="px-1 py-2 text-right text-slate-700">{brl(it.valorUnitario)}</td>
      <td className="px-1 py-2 text-right font-medium">{brl(it.valorDisponivel)}</td>
      <td className="px-1 py-2 text-center">{acoes}</td>
    </tr>
  );
}
