"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { FaixaImr } from "@/lib/glosas";
import { excluirIndicadorImrAction, salvarIndicadorImrAction } from "@/app/actions/glosas";
import type { IndicadorImrDto } from "@/components/GlosasBloco";

/**
 * Aba "IMR" do contrato de mão de obra (ESP-005 RN03, opcional): indicadores
 * com meta e faixas de pontuação → percentual do valor a pagar. Na
 * competência a pessoa informa a pontuação e o sistema calcula o ajuste.
 */
export function ImrTab({ contratoId, indicadores, podeEditar }: { contratoId: string; indicadores: IndicadorImrDto[]; podeEditar: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<IndicadorImrDto | "novo" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Instrumento de Medição de Resultado (IMR)</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-600">
            Opcional. Cadastre os indicadores do contrato (IN SEGES/MP 5/2017, Anexo V-B) com as faixas de pontuação e o percentual do valor a pagar em cada faixa. Em cada competência você informa a pontuação obtida e o ajuste vira uma glosa do tipo IMR.
          </p>
        </div>
        {podeEditar && (
          <button type="button" className="btn-primary inline-flex" onClick={() => setEditando("novo")}>
            <Plus className="h-4 w-4" /> Indicador
          </button>
        )}
      </div>
      {aviso && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{aviso}</p>}
      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      {editando && (
        <FormIndicador
          contratoId={contratoId}
          inicial={editando === "novo" ? null : editando}
          proximaOrdem={indicadores.length + 1}
          onFechar={() => setEditando(null)}
          onOk={(m) => {
            setEditando(null);
            setAviso(m);
            router.refresh();
          }}
        />
      )}

      {indicadores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-600">Nenhum indicador cadastrado. Sem IMR, as glosas são registradas diretamente na competência.</div>
      ) : (
        <ul className="space-y-2">
          {indicadores.map((i) => (
            <li key={i.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {i.nome}
                    {i.meta && <span className="ml-2 font-normal text-slate-600">· meta: {i.meta}</span>}
                  </p>
                  {i.descricao && <p className="text-xs text-slate-600">{i.descricao}</p>}
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {i.faixas.map((f, k) => (
                      <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {f.de}–{f.ate} pts → {f.percentualPagamento}% do valor
                      </span>
                    ))}
                  </p>
                </div>
                {podeEditar && (
                  <div className="flex gap-1">
                    <button type="button" className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditando(i)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1.5 text-red-600 hover:bg-red-50"
                      disabled={pendente}
                      aria-label="Excluir"
                      onClick={() =>
                        confirm(`Excluir o indicador "${i.nome}"?`) &&
                        start(async () => {
                          const r = await excluirIndicadorImrAction(i.id);
                          if (r?.erro) setErro(r.erro);
                          else {
                            setAviso(r?.mensagem ?? "Excluído.");
                            router.refresh();
                          }
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type FaixaForm = { key: number; de: string; ate: string; pct: string };

function FormIndicador({ contratoId, inicial, proximaOrdem, onFechar, onOk }: { contratoId: string; inicial: IndicadorImrDto | null; proximaOrdem: number; onFechar: () => void; onOk: (m: string) => void }) {
  const [faixas, setFaixas] = useState<FaixaForm[]>(
    inicial?.faixas.length
      ? inicial.faixas.map((f, k) => ({ key: k, de: String(f.de), ate: String(f.ate), pct: String(f.percentualPagamento) }))
      : [
          { key: 0, de: "90", ate: "100", pct: "100" },
          { key: 1, de: "80", ate: "89", pct: "97" },
          { key: 2, de: "70", ate: "79", pct: "94" },
          { key: 3, de: "0", ate: "69", pct: "90" },
        ],
  );
  const [seq, setSeq] = useState(10);
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof salvarIndicadorImrAction>>, fd: FormData) => {
      const r = await salvarIndicadorImrAction(prev, fd);
      if (r?.ok && r.mensagem) onOk(r.mensagem);
      return r;
    },
    null,
  );
  const faixasJson: FaixaImr[] = faixas
    .map((f) => ({ de: Number(f.de.replace(",", ".")), ate: Number(f.ate.replace(",", ".")), percentualPagamento: Number(f.pct.replace(",", ".")) }))
    .filter((f) => Number.isFinite(f.de) && Number.isFinite(f.ate) && Number.isFinite(f.percentualPagamento));
  return (
    <form action={action} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input type="hidden" name="ordem" value={proximaOrdem} />
      <input type="hidden" name="faixas" value={JSON.stringify(faixasJson)} />
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-slate-900">{inicial ? `Editar: ${inicial.nome}` : "Novo indicador"}</p>
        <button type="button" onClick={onFechar} aria-label="Fechar">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Nome</span>
          <input name="nome" required className="mt-1 w-full" defaultValue={inicial?.nome ?? ""} placeholder="Ex.: Pontualidade dos postos" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Meta</span>
          <input name="meta" className="mt-1 w-full" defaultValue={inicial?.meta ?? ""} placeholder="Ex.: ≥ 90 pontos" />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Como é medido</span>
          <input name="descricao" className="mt-1 w-full" defaultValue={inicial?.descricao ?? ""} placeholder="Ex.: 100 − (faltas sem reposição × 5)" />
        </label>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Faixas de pontuação → percentual do valor a pagar</p>
      <table className="mt-1 w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1 text-left">De</th>
            <th className="py-1 text-left">Até</th>
            <th className="py-1 text-left">% do valor</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {faixas.map((f) => (
            <tr key={f.key} className="border-t border-slate-100">
              <td className="py-1 pr-2">
                <input className="w-full !py-1" inputMode="decimal" value={f.de} onChange={(e) => setFaixas(faixas.map((x) => (x.key === f.key ? { ...x, de: e.target.value } : x)))} />
              </td>
              <td className="py-1 pr-2">
                <input className="w-full !py-1" inputMode="decimal" value={f.ate} onChange={(e) => setFaixas(faixas.map((x) => (x.key === f.key ? { ...x, ate: e.target.value } : x)))} />
              </td>
              <td className="py-1 pr-2">
                <input className="w-full !py-1" inputMode="decimal" value={f.pct} onChange={(e) => setFaixas(faixas.map((x) => (x.key === f.key ? { ...x, pct: e.target.value } : x)))} />
              </td>
              <td className="py-1 text-right">
                <button type="button" onClick={() => setFaixas(faixas.filter((x) => x.key !== f.key))} aria-label="Remover faixa">
                  <X className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
        onClick={() => {
          setFaixas([...faixas, { key: seq, de: "", ate: "", pct: "" }]);
          setSeq(seq + 1);
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Faixa
      </button>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar indicador"}
        </button>
      </div>
    </form>
  );
}
