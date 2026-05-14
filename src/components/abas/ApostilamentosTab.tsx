"use client";

import { useActionState } from "react";
import { brl } from "@/lib/validators";
import { criarApostilamentoAction } from "@/app/actions/contratuais";

type Apostilamento = {
  id: string;
  numero: string;
  objeto: string;
  dataAssinatura: Date;
  natureza: string;
  alteraValor: boolean;
  novoValor: number | null;
  alteraPrazoVigencia: boolean;
  novaVigenciaFim: Date | null;
  alteraPrazoEntrega: boolean;
  novoPrazoEntregaDias: number | null;
  observacoes: string | null;
  arquivoPdfUrl: string | null;
};

export function ApostilamentosTab({
  apostilamentos,
  contratoId,
  empenhoId,
  ataId,
}: {
  apostilamentos: Apostilamento[];
  contratoId?: string;
  empenhoId?: string;
  ataId?: string;
}) {
  const [state, formAction] = useActionState(criarApostilamentoAction, null);

  return (
    <div className="space-y-6">
      {apostilamentos.length > 0 && (
        <ul className="space-y-2">
          {apostilamentos.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <h4 className="font-semibold text-slate-900">Apostilamento {a.numero}</h4>
              <p className="text-sm text-slate-600">{a.objeto}</p>
              <p className="mt-1 text-xs text-slate-500">
                Assinado em {a.dataAssinatura.toLocaleDateString("pt-BR")} · {a.natureza}
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-slate-600 md:grid-cols-3">
                {a.alteraValor && a.novoValor && <li>💰 Novo valor: {brl(a.novoValor)}</li>}
                {a.alteraPrazoVigencia && a.novaVigenciaFim && (
                  <li>📅 Nova vigência: {a.novaVigenciaFim.toLocaleDateString("pt-BR")}</li>
                )}
                {a.alteraPrazoEntrega && a.novoPrazoEntregaDias && <li>🚚 Prazo: {a.novoPrazoEntregaDias}d</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Cadastrar apostilamento</summary>
        <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          {ataId && <input type="hidden" name="ataId" value={ataId} />}
          <Campo label="Número" name="numero" required />
          <Campo label="Data" name="dataAssinatura" type="date" required />
          <Campo label="Objeto" name="objeto" required colSpan={2} />
          <Campo label="Natureza" name="natureza" colSpan={2} />
          <Toggle label="Altera valor?" name="alteraValor" />
          <Campo label="Novo valor" name="novoValor" type="number" step="0.01" />
          <Toggle label="Altera vigência?" name="alteraPrazoVigencia" />
          <Campo label="Nova vigência fim" name="novaVigenciaFim" type="date" />
          {ataId && (
            <Campo
              label="Reajuste % nos itens (opcional)"
              name="percentualReajusteItens"
              type="number"
              step="0.01"
              placeholder="Ex: 5 para +5%"
              colSpan={2}
            />
          )}
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Arquivo (PDF)</span>
            <input type="file" name="arquivo" accept="application/pdf" className="text-xs" />
          </label>
          {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
          {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Apostilamento cadastrado.</div>}
          <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            Salvar
          </button>
        </form>
      </details>
    </div>
  );
}

function Campo({
  label,
  colSpan = 1,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; colSpan?: 1 | 2 }) {
  return (
    <label className={`flex flex-col gap-1 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input {...props} className="rounded border border-slate-300 px-2 py-1 text-xs" />
    </label>
  );
}

function Toggle({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" name={name} className="rounded border-slate-300" />
      {label}
    </label>
  );
}
