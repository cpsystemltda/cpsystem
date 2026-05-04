"use client";

import { useActionState } from "react";
import { brl } from "@/lib/validators";
import { criarGarantiaAction, adicionarEndossoAction } from "@/app/actions/contratuais";

type Endosso = {
  id: string;
  valor: number;
  dataInicio: Date;
  dataFim: Date | null;
  observacoes: string | null;
  arquivoPdfUrl: string | null;
};
type Garantia = {
  id: string;
  modalidade: string;
  seguradora: string | null;
  banco: string | null;
  valor: number;
  dataInicio: Date;
  dataFim: Date | null;
  descricao: string | null;
  arquivoPdfUrl: string | null;
  endossos: Endosso[];
};

const MODALIDADES_LABEL: Record<string, string> = {
  SEGURO_GARANTIA: "Seguro-garantia",
  FIANCA_BANCARIA: "Fiança bancária",
  CAUCAO_DINHEIRO: "Caução em dinheiro",
  TITULOS_DIVIDA_PUBLICA: "Títulos da dívida pública",
};

export function GarantiasTab({ garantias, contratoId, empenhoId }: { garantias: Garantia[]; contratoId?: string; empenhoId?: string }) {
  const [state, formAction] = useActionState(criarGarantiaAction, null);

  return (
    <div className="space-y-6">
      {garantias.length > 0 && (
        <ul className="space-y-3">
          {garantias.map((g) => {
            const venceEm = g.dataFim ? Math.ceil((g.dataFim.getTime() - Date.now()) / 86400000) : null;
            const valorTotal = g.valor + g.endossos.reduce((s, e) => s + e.valor, 0);
            return (
              <li key={g.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{MODALIDADES_LABEL[g.modalidade]}</h4>
                    <div className="mt-1 grid gap-x-4 text-xs text-slate-600 md:grid-cols-2">
                      {g.seguradora && <span>Seguradora: {g.seguradora}</span>}
                      {g.banco && <span>Banco: {g.banco}</span>}
                      <span>Valor base: {brl(g.valor)}</span>
                      {g.endossos.length > 0 && <span className="font-medium">Total c/ endossos: {brl(valorTotal)}</span>}
                      <span>Início: {g.dataInicio.toLocaleDateString("pt-BR")}</span>
                      {g.dataFim && (
                        <span className={venceEm !== null && venceEm < 30 ? "text-red-600 font-medium" : ""}>
                          Fim: {g.dataFim.toLocaleDateString("pt-BR")} {venceEm !== null && `(${venceEm}d)`}
                        </span>
                      )}
                    </div>
                    {g.modalidade === "CAUCAO_DINHEIRO" && g.dataFim && venceEm !== null && venceEm < 30 && (
                      <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        💡 Caução em dinheiro próxima ao fim — solicite o resgate ao órgão.
                      </div>
                    )}
                    {g.descricao && <p className="mt-2 text-xs text-slate-600">{g.descricao}</p>}
                  </div>
                  {g.arquivoPdfUrl && (
                    <a href={g.arquivoPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                      PDF
                    </a>
                  )}
                </div>

                {g.endossos.length > 0 && (
                  <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
                    <h5 className="text-xs font-semibold text-slate-700">Endossos</h5>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {g.endossos.map((e) => (
                        <li key={e.id}>
                          + {brl(e.valor)} · {e.dataInicio.toLocaleDateString("pt-BR")}
                          {e.dataFim && <> → {e.dataFim.toLocaleDateString("pt-BR")}</>}
                          {e.observacoes && ` · ${e.observacoes}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-blue-600">+ Adicionar endosso</summary>
                  <FormEndosso garantiaId={g.id} />
                </details>
              </li>
            );
          })}
        </ul>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Cadastrar garantia contratual</summary>
        <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Modalidade</span>
            <select name="modalidade" required className="rounded border border-slate-300 px-2 py-1 text-xs">
              {Object.entries(MODALIDADES_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <Campo label="Seguradora (se aplicável)" name="seguradora" />
          <Campo label="Banco (se fiança)" name="banco" />
          <Campo label="Valor" name="valor" type="number" step="0.01" required />
          <div />
          <Campo label="Início" name="dataInicio" type="date" required />
          <Campo label="Fim" name="dataFim" type="date" />
          <Campo label="Descrição (títulos/outros)" name="descricao" colSpan={2} />
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Arquivo</span>
            <input type="file" name="arquivo" accept="application/pdf" className="text-xs" />
          </label>
          {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
          {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Garantia cadastrada.</div>}
          <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            Salvar garantia
          </button>
        </form>
      </details>
    </div>
  );
}

function FormEndosso({ garantiaId }: { garantiaId: string }) {
  const [state, formAction] = useActionState(adicionarEndossoAction, null);
  return (
    <form action={formAction} className="mt-2 grid grid-cols-3 gap-2 text-sm">
      <input type="hidden" name="garantiaId" value={garantiaId} />
      <input
        type="number"
        step="0.01"
        name="valor"
        placeholder="Valor"
        required
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <input
        type="date"
        name="dataInicio"
        required
        className="rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <input type="date" name="dataFim" className="rounded border border-slate-300 px-2 py-1 text-xs" />
      <input
        name="observacoes"
        placeholder="Observações"
        className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <input type="file" name="arquivo" accept="application/pdf" className="text-xs col-span-1" />
      {state?.erro && <div className="col-span-3 text-xs text-red-700">{state.erro}</div>}
      <button type="submit" className="col-span-3 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
        Adicionar endosso
      </button>
    </form>
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
