"use client";

import { useState, useTransition } from "react";
import { Check, FileText, Undo2 } from "lucide-react";
import { registrarEntregaAction, desfazerEntregaAction } from "@/app/actions/entregas";

/**
 * A etapa de entrega, agora com natureza e quantitativo.
 *
 * Demanda de cliente 23/09/2026: "Registrar data" abre quatro caminhos —
 * entrega total, parcial, inexecução total e inexecução parcial. Na parcial,
 * a lista de itens aparece com o que ainda falta, e a pessoa preenche só o que
 * saiu naquela data.
 *
 * O campo de quantidade já vem com o que falta pré-preenchido: na maioria das
 * vezes a última parcela fecha tudo, e digitar de novo um número que o sistema
 * já sabe é trabalho à toa.
 */

type Item = { id: string; descricao: string; unidade: string; quantidade: number; entregue: number; falta: number };

type Props = {
  empenhoId: string;
  ordem: number;
  itens: Item[];
  /** Entrega já registrada nesta posição da linha do tempo. */
  registrada?: {
    id: string;
    tipo: "TOTAL" | "PARCIAL" | "INEXECUCAO_TOTAL" | "INEXECUCAO_PARCIAL";
    data: Date;
    observacao: string | null;
    arquivoUrl: string | null;
    itens: { itemId: string; quantidade: number }[];
  } | null;
  bloqueado?: boolean;
};

const OPCOES = [
  { valor: "TOTAL", rotulo: "Entrega total", ajuda: "Saiu tudo o que foi empenhado." },
  { valor: "PARCIAL", rotulo: "Entrega parcial", ajuda: "Saiu uma parte — informe o que foi entregue." },
  { valor: "INEXECUCAO_TOTAL", rotulo: "Inexecução total", ajuda: "Nada foi entregue. Tranca a esteira." },
  { valor: "INEXECUCAO_PARCIAL", rotulo: "Inexecução parcial", ajuda: "Parte não será entregue. A esteira segue, com marcação." },
] as const;

const CORES: Record<string, string> = {
  TOTAL: "bg-emerald-100 text-emerald-800",
  PARCIAL: "bg-amber-100 text-amber-800",
  INEXECUCAO_TOTAL: "bg-red-100 text-red-800",
  INEXECUCAO_PARCIAL: "bg-orange-100 text-orange-800",
};

const ROTULOS: Record<string, string> = {
  TOTAL: "Entrega total",
  PARCIAL: "Entrega parcial",
  INEXECUCAO_TOTAL: "Inexecução total",
  INEXECUCAO_PARCIAL: "Inexecução parcial",
};

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

export function RegistrarEntrega({ empenhoId, ordem, itens, registrada, bloqueado }: Props) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<string>("TOTAL");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const r = await registrarEntregaAction(null, formData);
      if (r?.erro) setErro(r.erro);
      else setAberto(false);
    });
  }

  function handleDesfazer(id: string) {
    if (!window.confirm("Desfazer este registro de entrega? Os quantitativos lançados serão apagados.")) return;
    const fd = new FormData();
    fd.set("entregaId", id);
    setErro(null);
    startTransition(async () => {
      const r = await desfazerEntregaAction(null, fd);
      if (r?.erro) setErro(r.erro);
    });
  }

  // ── Já registrada ─────────────────────────────────────────────────────────
  if (registrada) {
    const porItem = new Map(registrada.itens.map((i) => [i.itemId, i.quantidade]));
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            {registrada.data.toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CORES[registrada.tipo]}`}>
            {ROTULOS[registrada.tipo]}
          </span>
          {registrada.arquivoUrl && (
            <a href={registrada.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <FileText className="h-3.5 w-3.5" /> Comprovante
            </a>
          )}
          <button
            type="button"
            onClick={() => handleDesfazer(registrada.id)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"
          >
            <Undo2 className="h-3 w-3" /> Desfazer
          </button>
        </div>

        {registrada.tipo === "PARCIAL" && registrada.itens.length > 0 && (
          <ul className="ml-1 space-y-0.5 text-[11px] text-slate-600">
            {itens
              .filter((i) => porItem.has(i.id))
              .map((i) => (
                <li key={i.id}>
                  ▫ {i.descricao} — <strong>{num(porItem.get(i.id)!)} {i.unidade}</strong>
                </li>
              ))}
          </ul>
        )}

        {registrada.observacao && (
          <p className="ml-1 text-[11px] italic text-slate-500">{registrada.observacao}</p>
        )}
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
    );
  }

  if (bloqueado) return <span className="text-xs text-slate-400">Aguardando etapa anterior</span>;

  // ── Registrar ─────────────────────────────────────────────────────────────
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
      >
        <div className="h-4 w-4 rounded border-2 border-slate-400" />
        Registrar data
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <input type="hidden" name="empenhoId" value={empenhoId} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-600">Data</label>
        <input
          type="date"
          name="data"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {ordem > 1 && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            Entrega {ordem}
          </span>
        )}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs font-medium text-slate-600">O que aconteceu</legend>
        {OPCOES.map((o) => (
          <label
            key={o.valor}
            className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition ${
              tipo === o.valor ? "border-blue-400 bg-blue-50/60" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="tipo"
              value={o.valor}
              checked={tipo === o.valor}
              onChange={(e) => setTipo(e.target.value)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-800">{o.rotulo}</span>
              <span className="block text-[10px] text-slate-500">{o.ajuda}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {tipo === "PARCIAL" && (
        <div className="rounded-md border border-slate-200 bg-white p-2.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Quanto saiu nesta data
          </p>
          <div className="space-y-1.5">
            {itens.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={i.descricao}>
                  {i.descricao}
                </span>
                <span className="text-[10px] text-slate-500">
                  falta {num(i.falta)} de {num(i.quantidade)} {i.unidade}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  name={`item_${i.id}`}
                  defaultValue={i.falta > 0 ? num(i.falta) : ""}
                  disabled={i.falta <= 0}
                  placeholder="0"
                  className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-xs outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Deixe em branco o item que não saiu nesta data. O que faltar vira a próxima entrega.
          </p>
        </div>
      )}

      {(tipo === "INEXECUCAO_TOTAL" || tipo === "INEXECUCAO_PARCIAL") && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
          <label className="mb-1 block text-[11px] font-semibold text-amber-900">
            Motivo {tipo === "INEXECUCAO_TOTAL" ? "(recomendado)" : "(recomendado)"}
          </label>
          <textarea
            name="observacao"
            rows={2}
            placeholder="Ex.: fornecedor não entregou o insumo; órgão cancelou o pedido."
            className="w-full rounded-md border border-amber-300 px-2 py-1.5 text-xs outline-none focus:border-amber-500"
          />
          <p className="mt-1 text-[10px] text-amber-800">
            {tipo === "INEXECUCAO_TOTAL"
              ? "A esteira fica travada: sem nota fiscal, encaminhamento ou pagamento."
              : "A esteira segue, e o fornecimento fica marcado com inexecução parcial."}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Check className="h-3 w-3" /> {isPending ? "Salvando…" : "Confirmar"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </form>
  );
}
