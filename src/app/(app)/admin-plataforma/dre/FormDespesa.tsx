"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { lancarDespesaAction, excluirDespesaAction } from "@/app/actions/dre";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA } from "@/lib/dreConstantes";

export function FormDespesa({ competenciaAtual }: { competenciaAtual: string }) {
  const [state, action] = useActionState(lancarDespesaAction, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>Competência (mês)</span>
        <input type="month" name="competencia" defaultValue={competenciaAtual} required className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>Categoria</span>
        <select name="categoria" required className="rounded border border-slate-300 px-2 py-1.5 text-sm" defaultValue="INFRAESTRUTURA">
          {CATEGORIAS_DESPESA.map((c) => (
            <option key={c} value={c}>{ROTULO_CATEGORIA[c]}</option>
          ))}
        </select>
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>Descrição</span>
        <input name="descricao" required maxLength={120} placeholder="ex.: Vercel Pro, Neon Launch, Anthropic (uso de outubro)" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>Valor (R$)</span>
        <input name="valor" required inputMode="decimal" placeholder="0,00" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium" style={{ color: "var(--text-soft)" }}>Repetir nos próximos (meses)</span>
        <input type="number" name="repetir" min={0} max={24} defaultValue={0} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {state?.erro && <p className="col-span-2 text-xs text-rose-700">{state.erro}</p>}
      {state?.ok && <p className="col-span-2 text-xs text-emerald-700">Despesa lançada.</p>}
      <div className="col-span-2">
        <BotaoLancar />
      </div>
    </form>
  );
}

function BotaoLancar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary inline-flex disabled:opacity-60">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Lançar
    </button>
  );
}

export function BotaoExcluirDespesa({ id, descricao }: { id: string; descricao: string }) {
  const [state, action] = useActionState(excluirDespesaAction, null);
  return (
    <form
      action={action}
      onSubmit={(ev) => {
        if (!window.confirm(`Excluir a despesa "${descricao}"?`)) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" title="Excluir" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
        <Trash2 className="h-4 w-4" />
      </button>
      {state?.erro && <span className="ml-1 text-[10px] text-rose-700">{state.erro}</span>}
    </form>
  );
}
