"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { alterarPostosAction } from "@/app/actions/competencias";
import { brl } from "@/lib/validators";

/**
 * ESP-002 RN07: acréscimo ou supressão de postos por aditivo gera nova
 * versão dos itens com data de efeito. As competências a partir dessa data
 * passam a usar os valores novos (as já faturadas não mudam).
 */

type ItemAtual = { id: string; descricao: string; unidade: string; quantidade: number; valorUnitario: number };
type LinhaNova = { key: number; descricao: string; quantidade: string; valorUnitario: string; jornada: string };
type Props = {
  contratoId: string;
  vigenciaId: string;
  itens: ItemAtual[];
  aditivos: { id: string; numero: string; dataAssinatura: string }[];
  hojeIso: string;
};

function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s|R\$/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AlterarPostosForm(props: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [versao, setVersao] = useState(0);
  if (!aberto) {
    return (
      <div className="flex justify-end px-1 pb-1">
        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => setAberto(true)}>
          Acréscimo ou supressão de postos (aditivo)
        </button>
      </div>
    );
  }
  return (
    <Formulario
      key={versao}
      {...props}
      onFechar={() => setAberto(false)}
      onConcluido={() => {
        setAberto(false);
        setVersao((v) => v + 1);
        router.refresh();
      }}
    />
  );
}

function Formulario({ contratoId, vigenciaId, itens, aditivos, hojeIso, onFechar, onConcluido }: Props & { onFechar: () => void; onConcluido: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof alterarPostosAction>>, fd: FormData) => {
      const r = await alterarPostosAction(prev, fd);
      if (r?.ok) onConcluido();
      return r;
    },
    null,
  );
  const [edits, setEdits] = useState<Record<string, { quantidade: string; valorUnitario: string; remover: boolean }>>(
    Object.fromEntries(itens.map((i) => [i.id, { quantidade: String(i.quantidade), valorUnitario: fmt(i.valorUnitario), remover: false }])),
  );
  const [novas, setNovas] = useState<LinhaNova[]>([]);
  const [seq, setSeq] = useState(1);

  const alteracoes = [
    ...itens
      .map((i) => {
        const e = edits[i.id];
        const q = parseNum(e.quantidade) ?? i.quantidade;
        const v = parseNum(e.valorUnitario) ?? i.valorUnitario;
        if (!e.remover && q === i.quantidade && Math.abs(v - i.valorUnitario) < 0.005) return null;
        return { itemId: i.id, descricao: i.descricao, quantidade: q, valorUnitario: v, remover: e.remover };
      })
      .filter(Boolean),
    ...novas
      .filter((n) => n.descricao.trim())
      .map((n) => ({ itemId: null, descricao: n.descricao, quantidade: parseNum(n.quantidade) ?? 0, valorUnitario: parseNum(n.valorUnitario) ?? 0, jornada: n.jornada || null })),
  ];
  const mensalAtual = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
  const mensalNovo =
    itens.reduce((s, i) => {
      const e = edits[i.id];
      if (e.remover) return s;
      return s + (parseNum(e.quantidade) ?? i.quantidade) * (parseNum(e.valorUnitario) ?? i.valorUnitario);
    }, 0) + novas.reduce((s, n) => s + (parseNum(n.quantidade) ?? 0) * (parseNum(n.valorUnitario) ?? 0), 0);

  return (
    <form action={action} className="m-1 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      <input type="hidden" name="vigenciaId" value={vigenciaId} />
      <input type="hidden" name="alteracoes" value={JSON.stringify(alteracoes)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Acréscimo ou supressão de postos</p>
          <p className="text-xs text-slate-600">Gera uma nova versão dos postos a partir da data de efeito. Competências ainda não faturadas são recalculadas; o histórico guarda a versão anterior.</p>
        </div>
        <button type="button" onClick={onFechar} aria-label="Fechar">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Data de efeito</span>
          <input name="dataEfeito" type="date" required className="mt-1 w-full" defaultValue={hojeIso} />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Termo aditivo (opcional)</span>
          <select name="termoAditivoId" className="mt-1 w-full" defaultValue="">
            <option value="">Sem vínculo com aditivo cadastrado</option>
            {aditivos.map((a) => (
              <option key={a.id} value={a.id}>
                TA {a.numero} · {a.dataAssinatura.slice(0, 10).split("-").reverse().join("/")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <table className="mt-3 w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-1 text-left">Posto</th>
            <th className="w-24 py-1 text-right">Qtde</th>
            <th className="w-32 py-1 text-right">Valor mensal unit.</th>
            <th className="w-20 py-1 text-center">Suprimir</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => {
            const e = edits[i.id];
            return (
              <tr key={i.id} className={`border-t border-slate-200 ${e.remover ? "opacity-50" : ""}`}>
                <td className="py-1 pr-2 text-slate-800">
                  {i.descricao}
                  <span className="ml-1 text-slate-400">
                    ({i.quantidade} × {brl(i.valorUnitario)})
                  </span>
                </td>
                <td className="py-1">
                  <input className="w-full !py-1 text-right" inputMode="decimal" value={e.quantidade} disabled={e.remover} onChange={(ev) => setEdits({ ...edits, [i.id]: { ...e, quantidade: ev.target.value } })} />
                </td>
                <td className="py-1 pl-2">
                  <input className="w-full !py-1 text-right" inputMode="decimal" value={e.valorUnitario} disabled={e.remover} onChange={(ev) => setEdits({ ...edits, [i.id]: { ...e, valorUnitario: ev.target.value } })} />
                </td>
                <td className="py-1 text-center">
                  <input type="checkbox" checked={e.remover} onChange={(ev) => setEdits({ ...edits, [i.id]: { ...e, remover: ev.target.checked } })} />
                </td>
              </tr>
            );
          })}
          {novas.map((n) => (
            <tr key={n.key} className="border-t border-slate-200 bg-white/60">
              <td className="py-1 pr-2">
                <div className="flex gap-1">
                  <input className="w-full !py-1" placeholder="Novo posto (função)" value={n.descricao} onChange={(ev) => setNovas(novas.map((x) => (x.key === n.key ? { ...x, descricao: ev.target.value } : x)))} />
                  <input className="w-32 !py-1" placeholder="jornada" value={n.jornada} onChange={(ev) => setNovas(novas.map((x) => (x.key === n.key ? { ...x, jornada: ev.target.value } : x)))} />
                </div>
              </td>
              <td className="py-1">
                <input className="w-full !py-1 text-right" inputMode="decimal" value={n.quantidade} onChange={(ev) => setNovas(novas.map((x) => (x.key === n.key ? { ...x, quantidade: ev.target.value } : x)))} />
              </td>
              <td className="py-1 pl-2">
                <input className="w-full !py-1 text-right" inputMode="decimal" value={n.valorUnitario} onChange={(ev) => setNovas(novas.map((x) => (x.key === n.key ? { ...x, valorUnitario: ev.target.value } : x)))} />
              </td>
              <td className="py-1 text-center">
                <button type="button" onClick={() => setNovas(novas.filter((x) => x.key !== n.key))} aria-label="Remover linha">
                  <X className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          onClick={() => {
            setNovas([...novas, { key: seq, descricao: "", quantidade: "1", valorUnitario: "", jornada: "" }]);
            setSeq(seq + 1);
          }}
        >
          <Plus className="h-3.5 w-3.5" /> Novo posto
        </button>
        <span className="text-slate-700">
          Valor mensal: {brl(mensalAtual)} → <strong>{brl(mensalNovo)}</strong>
        </span>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending || alteracoes.length === 0}>
          {pending ? "Salvando…" : "Aplicar alteração"}
        </button>
      </div>
    </form>
  );
}
