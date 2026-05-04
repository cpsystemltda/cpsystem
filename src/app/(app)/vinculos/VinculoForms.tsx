"use client";

import { useActionState, useState } from "react";
import { Loader2, X, Check } from "lucide-react";
import { useFormStatus } from "react-dom";
import {
  criarVinculoAnalistaAction,
  atualizarFixoAction,
  encerrarVinculoAction,
  marcarFixoPagoAction,
} from "@/app/actions/vinculoAnalista";
import { brl } from "@/lib/validators";

type AnalistaOpt = { value: string; label: string };

function Botao({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : null}
      {children}
    </button>
  );
}

export function NovoVinculoForm({ analistas }: { analistas: AnalistaOpt[] }) {
  const [state, formAction] = useActionState(criarVinculoAnalistaAction, null);
  if (analistas.length === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Nenhum analista cadastrado no sistema. Peça pro analista se cadastrar em /signup escolhendo "Sou analista".
      </p>
    );
  }
  return (
    <form action={formAction} className="grid grid-cols-3 gap-3">
      <label className="col-span-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">Analista</span>
        <select name="analistaId" required className="rounded border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">— selecione —</option>
          {analistas.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <Campo label="Comissão (%)" name="percentualComissao" type="number" step="0.1" min="0" max="100" defaultValue="0" />
      <Campo label="Fixo mensal (R$)" name="fixoMensal" type="number" step="0.01" min="0" defaultValue="0" />
      <Campo label="Dia vencimento" name="diaVencimentoFixo" type="number" min="1" max="28" defaultValue="5" />
      <Campo label="Data de início (regra de comissão)" name="dataInicio" type="date" defaultValue={new Date().toISOString().slice(0, 10)} colSpan={3} />
      {state?.erro && <div className="col-span-3 text-xs text-red-700">{state.erro}</div>}
      {state?.ok && <div className="col-span-3 text-xs text-emerald-700">Vínculo criado.</div>}
      <div className="col-span-3 mt-2">
        <Botao>Vincular analista</Botao>
      </div>
    </form>
  );
}

export function EditarFixoForm({
  vinculoId,
  fixoAtual,
  diaAtual,
}: {
  vinculoId: string;
  fixoAtual: number;
  diaAtual: number;
}) {
  const [state, formAction] = useActionState(atualizarFixoAction, null);
  const [editando, setEditando] = useState(false);

  if (!editando) {
    return (
      <button onClick={() => setEditando(true)} className="text-xs text-blue-600 hover:underline">
        Editar fixo: {brl(fixoAtual)}/mês (dia {diaAtual})
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="vinculoId" value={vinculoId} />
      <input
        type="number"
        step="0.01"
        min="0"
        name="fixoMensal"
        defaultValue={fixoAtual}
        className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <input
        type="number"
        min="1"
        max="28"
        name="diaVencimentoFixo"
        defaultValue={diaAtual}
        className="w-12 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
        <Check className="h-3 w-3" />
      </button>
      <button type="button" onClick={() => setEditando(false)} className="rounded border border-slate-300 px-2 py-1 text-xs">
        <X className="h-3 w-3" />
      </button>
      {state?.erro && <span className="text-[10px] text-red-700">{state.erro}</span>}
    </form>
  );
}

export function EncerrarVinculoButton({ vinculoId, nomeAnalista }: { vinculoId: string; nomeAnalista: string }) {
  const [state, formAction] = useActionState(encerrarVinculoAction, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Encerrar vínculo com ${nomeAnalista}? Comissões já cadastradas permanecem.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="vinculoId" value={vinculoId} />
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Encerrar vínculo
      </button>
      {state?.erro && <span className="ml-2 text-[10px] text-red-700">{state.erro}</span>}
    </form>
  );
}

export function MarcarFixoPagoForm({ vinculoId, competenciaAtual }: { vinculoId: string; competenciaAtual: string }) {
  return (
    <form action={marcarFixoPagoAction} className="inline">
      <input type="hidden" name="vinculoId" value={vinculoId} />
      <input type="hidden" name="competencia" value={competenciaAtual} />
      <button type="submit" className="text-xs text-blue-600 hover:underline">
        Marcar fixo de {competenciaAtual} como pago
      </button>
    </form>
  );
}

function Campo({
  label,
  colSpan = 1,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; colSpan?: 1 | 2 | 3 }) {
  const cls = colSpan === 1 ? "col-span-1" : colSpan === 2 ? "col-span-2" : "col-span-3";
  return (
    <label className={`flex flex-col gap-1 ${cls}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
    </label>
  );
}
