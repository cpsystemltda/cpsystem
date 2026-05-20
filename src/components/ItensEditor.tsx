"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Layers, Sparkles } from "lucide-react";
import { brl } from "@/lib/validators";

export type SugestaoMatchIa = {
  indexExtraido: number;
  ataItemId: string | null;
  confidence: number;
  razao: string;
};

export type AtaItemRef = {
  id: string;
  descricao: string;
  unidade: string;
  quantidadeDisponivel: number;
  valorUnitario: number;
};

export type LinhaItem = {
  id: string; // id do AtaItem existente (vazio quando linha nova)
  descricao: string;
  unidade: string;
  quantidade: string;
  marca: string;
  valorUnitario: string;
  ataItemId: string;
  lote: string;
  numero: string;
};

const VAZIA = (lote = "", numero = ""): LinhaItem => ({
  id: "",
  descricao: "",
  unidade: "",
  quantidade: "",
  marca: "",
  valorUnitario: "",
  ataItemId: "",
  lote,
  numero,
});

export type ItemInicial = {
  id?: string; // presente em modo edição
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
  lote?: string | null;
  numero?: string | null;
};

/**
 * Sugere próximo número de item dentro de um lote (ou item isolado quando
 * lote vazio): pega o maior número numérico já usado no mesmo agrupamento + 1.
 * Strings não-numéricas (ex: "1.A") são ignoradas no cálculo.
 */
function proximoNumeroItem(linhas: LinhaItem[], lote: string): string {
  const noLote = linhas.filter((l) => (l.lote ?? "").trim() === lote.trim());
  let maior = 0;
  for (const l of noLote) {
    const n = Number((l.numero ?? "").replace(/\D/g, ""));
    if (Number.isFinite(n) && n > maior) maior = n;
  }
  return String(maior + 1);
}

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
  sugestoesIa,
}: {
  ataItens?: AtaItemRef[];
  itensIniciais?: ItemInicial[];
  permitirLotes?: boolean;
  /** Sugestões de matching IA — quando presente, pré-popula o ataItemId
   *  na ordem dos itens iniciais. Confidence >= 0.6 = badge AUTO verde. */
  sugestoesIa?: SugestaoMatchIa[];
}) {
  // Mapeia sugestões IA por indexExtraido pra fácil lookup
  const sugestoesPorIndex = new Map<number, SugestaoMatchIa>();
  if (sugestoesIa) {
    for (const s of sugestoesIa) sugestoesPorIndex.set(s.indexExtraido, s);
  }

  const inicial: LinhaItem[] =
    itensIniciais && itensIniciais.length > 0
      ? itensIniciais.map((i, idx) => {
          const sug = sugestoesPorIndex.get(idx);
          return {
            id: i.id ?? "",
            descricao: i.descricao,
            unidade: i.unidade,
            quantidade: String(i.quantidade),
            marca: i.marca ?? "",
            valorUnitario: String(i.valorUnitario),
            // Pré-popula a partir da sugestão IA se confidence >= 0.6
            ataItemId: sug && sug.ataItemId && sug.confidence >= 0.6 ? sug.ataItemId : "",
            lote: i.lote ?? "",
            numero: i.numero ?? "",
          };
        })
      : [VAZIA("", "1")];
  const [linhas, setLinhas] = useState<LinhaItem[]>(inicial);

  // Mantém ataItemId pré-popular se chegou nova sugestão (ex.: IA roda
  // depois da montagem inicial). Só preenche linhas onde usuário não
  // alterou manualmente (ataItemId vazio).
  useEffect(() => {
    if (!sugestoesIa || sugestoesIa.length === 0) return;
    setLinhas((atuais) =>
      atuais.map((l, idx) => {
        if (l.ataItemId) return l; // usuário já escolheu — não sobrescreve
        const sug = sugestoesPorIndex.get(idx);
        if (!sug || !sug.ataItemId || sug.confidence < 0.6) return l;
        const ref = ataItens?.find((a) => a.id === sug.ataItemId);
        if (!ref) return l;
        return {
          ...l,
          ataItemId: sug.ataItemId,
          // Auto-preenche descrição/unidade da Ata se ainda em branco
          descricao: l.descricao || ref.descricao,
          unidade: l.unidade || ref.unidade,
          valorUnitario: l.valorUnitario || String(ref.valorUnitario),
        };
      }),
    );
    // sugestoesPorIndex é derivada de sugestoesIa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugestoesIa]);

  // Estado da máscara monetária (display formatado por linha)
  const [valoresFormatados, setValoresFormatados] = useState<string[]>(() =>
    inicial.map((l) =>
      l.valorUnitario ? Number(l.valorUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
    ),
  );

  function add() {
    setLinhas((l) => {
      // Continua o lote da última linha (mais natural pra inserção em sequência)
      const ultimaLote = l[l.length - 1]?.lote ?? "";
      const numeroSugerido = proximoNumeroItem(l, ultimaLote);
      return [...l, VAZIA(ultimaLote, numeroSugerido)];
    });
    setValoresFormatados((v) => [...v, ""]);
  }
  function addLote() {
    setLinhas((l) => {
      const lotesExistentes = new Set(l.map((x) => x.lote).filter(Boolean));
      const proximoLote = String(lotesExistentes.size + 1);
      // Item começa em 1 num lote novo
      return [...l, VAZIA(proximoLote, "1")];
    });
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

  // Detecta duplicidades Lote+Item pra dar feedback visual (campo numero
  // fica destacado em coral). Itens sem numero não geram duplicata.
  const indicesDuplicados = (() => {
    const dup = new Set<number>();
    const visto = new Map<string, number>();
    linhas.forEach((l, i) => {
      const numero = l.numero.trim();
      if (!numero) return;
      const chave = `${l.lote.trim().toLowerCase()}|${numero.toLowerCase()}`;
      if (visto.has(chave)) {
        dup.add(visto.get(chave)!);
        dup.add(i);
      } else {
        visto.set(chave, i);
      }
    });
    return dup;
  })();

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

      <div className="overflow-x-auto rounded-[16px]" style={{ border: "0.5px solid var(--hairline)" }}>
        <table className="w-full text-sm" style={{ minWidth: "980px", tableLayout: "fixed" }}>
          {/* colgroup: Descrição é a única coluna fluida; restante tem largura
             fixa enxuta pra caber sem scroll horizontal em viewport 1366. */}
          <colgroup>
            {permitirLotes && <col style={{ width: "60px" }} />}
            <col style={{ width: "60px" }} />{/* Item */}
            {ataItens && <col style={{ width: "160px" }} />}
            <col />{/* Descrição — pega o restante */}
            <col style={{ width: "56px" }} />{/* Un. */}
            <col style={{ width: "76px" }} />{/* Qtd. */}
            <col style={{ width: "96px" }} />{/* Marca */}
            <col style={{ width: "108px" }} />{/* Valor unit. */}
            <col style={{ width: "108px" }} />{/* Total */}
            <col style={{ width: "40px" }} />{/* Excluir */}
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
              <th
                className="px-3 py-3 text-left text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-mute)" }}
              >
                Item
              </th>
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
                key={l.id || `nova-${idx}`}
                style={{ borderTop: "0.5px solid var(--hairline)" }}
              >
                {permitirLotes && (
                  <td className="px-2 py-2 align-middle">
                    <input
                      name={`itens[${idx}][lote]`}
                      value={l.lote}
                      onChange={(ev) => {
                        const novoLote = ev.target.value;
                        const sugerido = proximoNumeroItem(
                          linhas.filter((_, i) => i !== idx),
                          novoLote,
                        );
                        update(idx, { lote: novoLote, numero: l.numero.trim() ? l.numero : sugerido });
                      }}
                      placeholder="—"
                      list="lotes-sugeridos"
                      className="w-full rounded-md px-1 py-1.5 text-center text-xs font-bold"
                      style={{
                        background: l.lote ? "rgba(212,175,55,0.18)" : "rgba(15,14,12,0.04)",
                        color: l.lote ? "var(--primary-deep)" : "var(--text-mute)",
                        border: "0.5px solid rgba(168,137,71,0.35)",
                      }}
                      title="Itens com o mesmo número de lote são agrupados na visualização. Deixe vazio para item isolado."
                    />
                  </td>
                )}
                <td className="px-2 py-2 align-middle">
                  {l.id && (
                    <input type="hidden" name={`itens[${idx}][id]`} value={l.id} />
                  )}
                  <input
                    name={`itens[${idx}][numero]`}
                    value={l.numero}
                    onChange={(ev) => update(idx, { numero: ev.target.value })}
                    placeholder={proximoNumeroItem(linhas.filter((_, i) => i !== idx), l.lote)}
                    className="w-full rounded-md px-1 py-1.5 text-center text-xs font-bold"
                    style={{
                      background: indicesDuplicados.has(idx)
                        ? "rgba(232,138,152,0.22)"
                        : l.numero
                          ? "rgba(15,14,12,0.04)"
                          : "rgba(15,14,12,0.02)",
                      color: indicesDuplicados.has(idx)
                        ? "var(--coral-deep)"
                        : l.numero
                          ? "var(--text)"
                          : "var(--text-mute)",
                      border: indicesDuplicados.has(idx)
                        ? "0.5px solid rgba(198,103,112,0.6)"
                        : "0.5px solid rgba(15,14,12,0.16)",
                    }}
                    title={
                      indicesDuplicados.has(idx)
                        ? "Número duplicado para este lote. Cada item precisa de número único dentro do mesmo lote."
                        : "Número do item dentro do lote (ou número global se item isolado). Sugestão: próximo disponível."
                    }
                  />
                </td>
                {ataItens && (
                  <td className="px-2 py-2 align-middle">
                    {(() => {
                      const sug = sugestoesPorIndex.get(idx);
                      const isAuto =
                        !!sug &&
                        sug.ataItemId === l.ataItemId &&
                        l.ataItemId !== "" &&
                        sug.confidence >= 0.6;
                      return (
                        <div className="relative">
                          <select
                            name={`itens[${idx}][ataItemId]`}
                            value={l.ataItemId}
                            onChange={(ev) => pickAtaItem(idx, ev.target.value)}
                            className="w-full rounded-md px-2 py-1.5 pr-7 text-xs"
                            style={
                              isAuto
                                ? {
                                    background: "rgba(93,216,182,0.10)",
                                    border: "0.5px solid rgba(93,216,182,0.4)",
                                  }
                                : undefined
                            }
                          >
                            <option value="">— Livre —</option>
                            {ataItens.map((a) => (
                              <option key={a.id} value={a.id} disabled={a.quantidadeDisponivel <= 0}>
                                {a.descricao.slice(0, 30)}
                                {a.descricao.length > 30 ? "…" : ""} ({a.quantidadeDisponivel} {a.unidade})
                              </option>
                            ))}
                          </select>
                          {isAuto && (
                            <span
                              className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
                              title={`IA · ${(sug.confidence * 100).toFixed(0)}% confiança — ${sug.razao}`}
                            >
                              <Sparkles
                                className="h-3 w-3"
                                style={{ color: "var(--mint)" }}
                              />
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                )}
                <td className="px-2 py-2 align-middle">
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
                <td className="px-2 py-2 align-middle">
                  <input
                    name={`itens[${idx}][unidade]`}
                    value={l.unidade}
                    onChange={(ev) => update(idx, { unidade: ev.target.value })}
                    required
                    placeholder="UN"
                    className="w-full rounded-md px-1 py-1.5 text-center text-xs"
                  />
                </td>
                <td className="px-2 py-2 align-middle">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={`itens[${idx}][quantidade]`}
                    value={l.quantidade}
                    onChange={(ev) => update(idx, { quantidade: ev.target.value })}
                    required
                    className="w-full rounded-md px-2 py-1.5 text-right text-xs"
                  />
                </td>
                <td className="px-2 py-2 align-middle">
                  <input
                    name={`itens[${idx}][marca]`}
                    value={l.marca}
                    onChange={(ev) => update(idx, { marca: ev.target.value })}
                    className="w-full rounded-md px-2 py-1.5 text-xs"
                  />
                </td>
                <td className="px-2 py-2 align-middle">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={valoresFormatados[idx] ?? ""}
                    onChange={(ev) => updateValor(idx, ev.target.value)}
                    required
                    className="w-full rounded-md px-2 py-1.5 text-right text-xs"
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
          <tfoot style={{ background: "rgba(15,14,12,0.04)" }}>
            <tr>
              <td
                colSpan={(permitirLotes ? 1 : 0) + 1 /* Item */ + (ataItens ? 1 : 0) + 5}
                className="px-3 py-3 text-right text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--text-soft)" }}
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
