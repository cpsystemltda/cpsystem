"use client";

import { useActionState } from "react";
import { criarNotificacaoAction, avancarNotificacaoAction } from "@/app/actions/contratuais";

type Andamento = { id: string; status: string; descricao: string; dataEvento: Date };
type Notificacao = {
  id: string;
  numero: string | null;
  assunto: string;
  descricao: string;
  dataRecebimento: Date;
  prazoResposta: number | null;
  status: string;
  arquivoPdfUrl: string | null;
  andamentos: Andamento[];
};

const COR: Record<string, string> = {
  RECEBIDA: "bg-amber-100 text-amber-800",
  EM_TRATATIVA: "bg-blue-100 text-blue-800",
  RESPONDIDA: "bg-violet-100 text-violet-800",
  FINALIZADA: "bg-emerald-100 text-emerald-800",
};

export function NotificacoesTab({
  notificacoes,
  ataId,
  contratoId,
  empenhoId,
}: {
  notificacoes: Notificacao[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [state, formAction] = useActionState(criarNotificacaoAction, null);

  return (
    <div className="space-y-6">
      {notificacoes.length > 0 && (
        <ul className="space-y-3">
          {notificacoes.map((n) => {
            const prazoFinal = n.prazoResposta
              ? new Date(n.dataRecebimento.getTime() + n.prazoResposta * 86400000)
              : null;
            const diasRestantes = prazoFinal ? Math.ceil((prazoFinal.getTime() - Date.now()) / 86400000) : null;

            return (
              <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{n.assunto}</h4>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${COR[n.status]}`}>
                        {n.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{n.descricao}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500">
                      {n.numero && <span>Nº {n.numero}</span>}
                      <span>Recebida em {n.dataRecebimento.toLocaleDateString("pt-BR")}</span>
                      {prazoFinal && (
                        <span className={diasRestantes !== null && diasRestantes < 3 ? "text-red-600 font-medium" : ""}>
                          Prazo: {prazoFinal.toLocaleDateString("pt-BR")}{" "}
                          {diasRestantes !== null && (diasRestantes >= 0 ? `(${diasRestantes}d)` : `(${-diasRestantes}d atraso)`)}
                        </span>
                      )}
                    </div>
                  </div>
                  {n.arquivoPdfUrl && (
                    <a href={n.arquivoPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                      PDF
                    </a>
                  )}
                </div>

                {n.andamentos.length > 0 && (
                  <ol className="mt-3 space-y-1 border-l-2 border-slate-200 pl-3">
                    {n.andamentos.map((a) => (
                      <li key={a.id} className="text-xs text-slate-600">
                        <span className="font-medium">{a.dataEvento.toLocaleDateString("pt-BR")}</span> ·{" "}
                        <span className="font-medium">{a.status.replace("_", " ")}</span> — {a.descricao}
                      </li>
                    ))}
                  </ol>
                )}

                {n.status !== "FINALIZADA" && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-blue-600">+ Avançar status</summary>
                    <form action={avancarNotificacaoAction} className="mt-2 grid grid-cols-3 gap-2 text-sm">
                      <input type="hidden" name="notificacaoId" value={n.id} />
                      <select name="status" required className="rounded border border-slate-300 px-2 py-1 text-xs">
                        <option value="EM_TRATATIVA">Em tratativa</option>
                        <option value="RESPONDIDA">Respondida</option>
                        <option value="FINALIZADA">Finalizada</option>
                      </select>
                      <input
                        type="date"
                        name="dataEvento"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                      <input
                        name="descricao"
                        placeholder="Descrição"
                        required
                        className="rounded border border-slate-300 px-2 py-1 text-xs col-span-3"
                      />
                      <button type="submit" className="col-span-3 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                        Adicionar andamento
                      </button>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Cadastrar notificação</summary>
        <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {ataId && <input type="hidden" name="ataId" value={ataId} />}
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <Campo label="Número (opcional)" name="numero" />
          <Campo label="Data de recebimento" name="dataRecebimento" type="date" required />
          <Campo label="Assunto" name="assunto" required colSpan={2} />
          <Campo label="Descrição" name="descricao" required colSpan={2} />
          <Campo label="Prazo de resposta (dias)" name="prazoResposta" type="number" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Arquivo</span>
            <input type="file" name="arquivo" accept="application/pdf" className="text-xs" />
          </label>
          {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
          {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Notificação cadastrada.</div>}
          <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            Salvar notificação
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
