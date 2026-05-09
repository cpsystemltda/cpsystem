"use client";

import { useState } from "react";
import { Trash2, Plus, Layers } from "lucide-react";
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
  lote: string;
};

const VAZIA = (lote = ""): LinhaItem => ({
  descricao: "",
  unidade: "",
  quantidade: "",
  marca: "",
  valorUnitario: "",
  ataItemId: "",
  lote,
});

export type ItemInicial = {
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
  lote?: string | null;
};

/* === Máscara monetária BRL — entrada como dígitos, render formatado === */
function formatarBrlInput(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  if (!digits) return "";
  const num = Number(digits) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseBrlInput(valor: string): number {
  const digits = valor.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function ItensEditor({
  ataItens,
  itensIniciais,
  permitirLotes = true,
}: {
  ataItens?: AtaItemRef[];
  itensIniciais?: ItemInicial[];
  permitirLotes?: boolean;
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
          lote: i.lote ?? "",
        }))
      : [VAZIA()];
  const [linhas, setLinhas] = useState<LinhaItem[]>(inicial);

  // Estado da máscara monetária (display formatado por linha)
  const [valoresFormatados, setValoresFormatados] = useState<string[]>(() =>
    inicial.map((l) =>
      l.valorUnitario ? Number(l.valorUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
    ),
  );

  function add() {
    setLinhas((l) => [...l, VAZIA()]);
    setValoresFormatados((v) => [...v, ""]);
  }
  function addLote() {
    // Cria nova linha já com sugestão de lote (próximo número)
    const lotesExistentes = new Set(linhas.map((l) => l.lote).filter(Boolean));
    const proximo = String(lotesExistentes.size + 1).padStart(2, "0");
    setLinhas((l) => [...l, VAZIA(proximo)]);
    setValoresFormatados((v) => [...v, ""]);
  }

  function rm(idx: number) {
    setLinhas((l) => (l.length === 1 ? l : l.filter((_, i) => i !== idx)));
    setValoresFormatados((v) => (v.length === 1 ? v : v.filter((_, i) => i !== idx)));
  }

  function update(idx: number, patch: Partial<LinhaItem>) {
    setLinhas((l) => l.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function updateValor(idx: number, valorDigitado: string) {
    const formatado = formatarBrlInput(valorDigitado);
    const numerico = parseBrlInput(valorDigitado);
    setValoresFormatados((v) => v.map((x, i) => (i === idx ? formatado : x)));
    update(idx, { valorUnitario: String(numerico) });
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
    const formatado = ref.valorUnitario.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setValoresFormatados((v) => v.map((x, i) => (i === idx ? formatado : x)));
  }

  const totalLinha = (l: LinhaItem) =>
    (Number(l.quantidade) || 0) * (Number(l.valorUnitario) || 0);
  const total = linhas.reduce((s, l) => s + totalLinha(l), 0);

  // Lotes únicos (pra mostrar resumo se tiver mais de 1)
  const lotesUnicos = Array.from(new Set(linhas.map((l) => l.lote).filter(Boolean)));

  return (
    <div>
      {permitirLotes && (
        <datalist id="lotes-sugeridos">
          {lotesUnicos.map((lote) => (
            <option key={lote} value={lote} />
          ))}
        </datalist>
      )}
      {permitirLotes && lotesUnicos.length > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-xs"
          style={{
            background: "rgba(212, 175, 55, 0.08)",
            border: "0.5px solid rgba(212, 175, 55, 0.25)",
            color: "var(--text-soft)",
          }}
        >
          <Layers className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <span style={{ color: "var(--primary-deep)", fontWeight: 700 }}>
            {lotesUnicos.length} lote{lotesUnicos.length > 1 ? "s" : ""}:
          </span>
          {lotesUnicos.map((lote) => {
            const itens = linhas.filter((l) => l.lote === lote);
            const valor = itens.reduce((s, l) => s + totalLinha(l), 0);
            return (
              <span
                key={lote}
                className="rounded-full px-2.5 py-1"
                style={{ background: "rgba(212, 175, 55, 0.14)", color: "var(--primary-deep)" }}
              >
                Lote {lote} · {itens.length} item{itens.length > 1 ? "ns" : ""} · {brl(valor)}
              </span>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl" style={{ border: "0.5px solid var(--hairline)" }}>
        <table className="w-full text-sm" style={{ minWidth: "1080px" }}>
          {/* colgroup garante que Descrição domine o espaço — ela é o único campo
             texto longo da linha; demais colunas têm largura fixa enxuta */}
          <colgroup>
            {permitirLotes && <col style={{ width: "72px" }} />}
            {ataItens && <col style={{ width: "180px" }} />}
            <col />{/* Descrição — pega o restante */}
            <col style={{ width: "72px" }} />{/* Un. */}
            <col style={{ width: "92px" }} />{/* Qtd. */}
            <col style={{ width: "112px" }} />{/* Marca */}
            <col style={{ width: "128px" }} />{/* Valor unit. */}
            <col style={{ width: "120px" }} />{/* Total */}
            <col style={{ width: "44px" }} />{/* Excluir */}
          </colgroup>
          <thead style={{ background: "rgba(15,14,12,0.04)" }}>
            <tr>
              {permitirLotes && (
                <th
                  className="px-3 py-3 text-left text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
                >
                  Lote
                </th>
              )}
              {ataItens && (
                <th
                  className="px-3 py-3 text-left text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
                >
                  Item da Ata
                </th>
              )}
              <th
                className="px-3 py-3 text-left text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Descrição
              </th>
              <th
                className="px-3 py-3 text-left text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Un.
              </th>
              <th
                className="px-3 py-3 text-right text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Qtd.
              </th>
              <th
                className="px-3 py-3 text-left text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Marca
              </th>
              <th
                className="px-3 py-3 text-right text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Valor unit.
              </th>
              <th
                className="px-3 py-3 text-right text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Total
              </th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, idx) => (
              <tr
                key={idx}
                style={{ borderTop: "0.5px solid var(--hairline)" }}
              >
                {permitirLotes && (
                  <td className="px-3 py-2">
                    <input
                      name={`itens[${idx}][lote]`}
                      value={l.lote}
                      onChange={(ev) => update(idx, { lote: ev.target.value })}
                      placeholder="—"
                      list="lotes-sugeridos"
                      className="w-16 rounded-md px-2 py-1.5 text-center text-xs font-bold"
                      style={{
                        background: l.lote ? "rgba(212,175,55,0.18)" : "rgba(15,14,12,0.04)",
                        color: l.lote ? "var(--primary-deep)" : "var(--text-mute)",
                        border: "0.5px solid rgba(168,137,71,0.35)",
                      }}
                      title="Itens com o mesmo número de lote são agrupados na visualização. Deixe vazio para item isolado."
                    />
                  </td>
                )}
                {ataItens && (
                  <td className="px-3 py-2">
                    <select
                      name={`itens[${idx}][ataItemId]`}
                      value={l.ataItemId}
                      onChange={(ev) => pickAtaItem(idx, ev.target.value)}
                      className="w-44 rounded-md px-2 py-1.5 text-xs"
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
                  <textarea
                    name={`itens[${idx}][descricao]`}
                    value={l.descricao}
                    onChange={(ev) => update(idx, { descricao: ev.target.value })}
                    required
                    rows={1}
                    placeholder="Descrição completa do item ou serviço…"
                    className="w-full rounded-md px-2.5 py-2 text-xs resize-y"
                    style={{ minHeight: "36px", lineHeight: "1.4" }}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    name={`itens[${idx}][unidade]`}
                    value={l.unidade}
                    onChange={(ev) => update(idx, { unidade: ev.target.value })}
                    required
                    placeholder="UN"
                    className="w-16 rounded-md px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={`itens[${idx}][quantidade]`}
                    value={l.quantidade}
                    onChange={(ev) => update(idx, { quantidade: ev.target.value })}
                    required
                    className="w-20 rounded-md px-2 py-1.5 text-right text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    name={`itens[${idx}][marca]`}
                    value={l.marca}
                    onChange={(ev) => update(idx, { marca: ev.target.value })}
                    className="w-24 rounded-md px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  {/* Máscara monetária — campo display + hidden numérico */}
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={valoresFormatados[idx] ?? ""}
                    onChange={(ev) => updateValor(idx, ev.target.value)}
                    required
                    className="w-28 rounded-md px-2 py-1.5 text-right text-xs"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                  <input
                    type="hidden"
                    name={`itens[${idx}][valorUnitario]`}
                    value={l.valorUnitario}
                  />
                </td>
                <td
                  className="px-3 py-2 text-right text-xs font-bold tabular-nums"
                  style={{ color: "var(--text)" }}
                >
                  {brl(totalLinha(l))}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => rm(idx)}
                    disabled={linhas.length === 1}
                    className="rounded-md p-1.5 transition disabled:opacity-30"
                    style={{ color: "var(--text-mute)" }}
                    title="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot style={{ background: "rgba(0,0,0,0.2)" }}>
            <tr>
              <td
                colSpan={(permitirLotes ? 1 : 0) + (ataItens ? 1 : 0) + 5}
                className="px-3 py-3 text-right text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Total geral
              </td>
              <td
                className="px-3 py-3 text-right text-base font-extrabold tabular-nums"
                style={{ color: "var(--primary-deep)", letterSpacing: "-0.02em" }}
              >
                {brl(total)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          style={{
            background: "rgba(255,255,255,0.8)",
            color: "var(--text-soft)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
        {permitirLotes && (
          <button
            type="button"
            onClick={addLote}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
            style={{
              background: "rgba(212, 175, 55, 0.14)",
              color: "var(--primary-deep)",
              border: "0.5px solid rgba(212, 175, 55, 0.3)",
            }}
          >
            <Layers className="h-3.5 w-3.5" /> Novo lote
          </button>
        )}
      </div>
    </div>
  );
}
