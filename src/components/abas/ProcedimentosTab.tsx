"use client";

import { useActionState } from "react";
import { brl } from "@/lib/validators";
import {
  criarProcedimentoAction,
  avancarProcedimentoAction,
  aplicarPenalidadeAction,
} from "@/app/actions/contratuais";

type Andamento = { id: string; fase: string; descricao: string; dataEvento: Date };
type Penalidade = {
  id: string;
  tipo: string;
  valor: number | null;
  duracaoMeses: number | null;
  fundamentacao: string | null;
  dataAplicacao: Date;
};
type Procedimento = {
  id: string;
  numero: string | null;
  notificacaoNumero: string | null;
  assunto: string;
  descricao: string;
  comissao: string | null;
  autoridade: string | null;
  dataAbertura: Date;
  prazoDefesaDias: number;
  prazoRecursoDias: number;
  arquivado: boolean;
  arquivoPdfUrl: string | null;
  andamentos: Andamento[];
  penalidades: Penalidade[];
};

const ROTULO_FASE: Record<string, string> = {
  ABERTURA: "Abertura",
  NOTIFICACAO_DEFESA: "Notificação para defesa",
  DEFESA_APRESENTADA: "Defesa apresentada",
  PEDIDO_PROVAS: "Pedido de provas",
  DEFERIMENTO_PROVAS: "Deferimento/indeferimento provas",
  NOTIFICACAO_ALEGACOES: "Notificação alegações finais",
  ALEGACOES_FINAIS: "Alegações finais",
  DECISAO_1A_INSTANCIA: "Decisão 1ª instância",
  RECURSO: "Recurso administrativo",
  DECISAO_FINAL: "Decisão final",
  ARQUIVAMENTO: "Arquivamento",
  PENALIDADE_APLICADA: "Penalidade aplicada",
};

export function ProcedimentosTab({
  procedimentos,
  ataId,
  contratoId,
  empenhoId,
}: {
  procedimentos: Procedimento[];
  ataId?: string;
  contratoId?: string;
  empenhoId?: string;
}) {
  const [state, formAction] = useActionState(criarProcedimentoAction, null);
  const hoje = Date.now();

  return (
    <div className="space-y-6">
      {procedimentos.length > 0 && (
        <ul className="space-y-4">
          {procedimentos.map((p) => {
            // Prazo de defesa: 15 dias a partir da notificação (ou abertura)
            const notifDefesa = p.andamentos.find((a) => a.fase === "NOTIFICACAO_DEFESA");
            const prazoDefesa = notifDefesa
              ? new Date(notifDefesa.dataEvento.getTime() + p.prazoDefesaDias * 86400000)
              : null;
            const defesaApresentada = p.andamentos.some((a) => a.fase === "DEFESA_APRESENTADA");

            // Prescrição quinquenal art. 158 §4º
            const prescricao = new Date(p.dataAbertura.getTime() + 5 * 365 * 86400000);
            const diasParaPrescrever = Math.ceil((prescricao.getTime() - hoje) / 86400000);

            return (
              <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      Procedimento {p.numero || "—"}
                      {p.arquivado && (
                        <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">ARQUIVADO</span>
                      )}
                    </h4>
                    <p className="text-sm text-slate-700">{p.assunto}</p>
                    <p className="mt-1 text-xs text-slate-500">{p.descricao}</p>
                    <div className="mt-2 grid gap-x-4 text-xs text-slate-600 md:grid-cols-2">
                      <span>Aberto em {p.dataAbertura.toLocaleDateString("pt-BR")}</span>
                      {p.notificacaoNumero && <span>Notif. nº {p.notificacaoNumero}</span>}
                      {p.comissao && <span>Comissão: {p.comissao}</span>}
                      {p.autoridade && <span>Autoridade: {p.autoridade}</span>}
                    </div>
                  </div>
                  {p.arquivoPdfUrl && (
                    <a href={p.arquivoPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                      PDF
                    </a>
                  )}
                </div>

                {/* Alertas */}
                <div className="mt-3 space-y-1">
                  {prazoDefesa && !defesaApresentada && (
                    <div
                      className={`rounded border px-2 py-1 text-xs ${
                        prazoDefesa.getTime() < hoje
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      ⚠ Prazo de defesa: {prazoDefesa.toLocaleDateString("pt-BR")} ({p.prazoDefesaDias}d a partir da notificação)
                    </div>
                  )}
                  {!p.arquivado && diasParaPrescrever <= 365 && (
                    <div className={`rounded border px-2 py-1 text-xs ${
                      diasParaPrescrever <= 0 ? "border-red-300 bg-red-100 text-red-800 font-medium" : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}>
                      ⚖ {diasParaPrescrever > 0 ? `Prescrição quinquenal em ${diasParaPrescrever}d` : `PRESCRITO há ${-diasParaPrescrever}d`} (Lei 14.133/2021 art. 158, §4º)
                    </div>
                  )}
                </div>

                {/* Linha do tempo */}
                {p.andamentos.length > 0 && (
                  <ol className="mt-4 space-y-1.5 border-l-2 border-slate-200 pl-3">
                    {p.andamentos.map((a) => (
                      <li key={a.id} className="text-xs">
                        <span className="text-slate-500">{a.dataEvento.toLocaleDateString("pt-BR")}</span> ·{" "}
                        <span className="font-medium text-slate-800">{ROTULO_FASE[a.fase] || a.fase}</span>
                        {a.descricao && <span className="text-slate-600"> — {a.descricao}</span>}
                      </li>
                    ))}
                  </ol>
                )}

                {/* Penalidades */}
                {p.penalidades.length > 0 && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50/30 p-3">
                    <h5 className="text-xs font-semibold text-red-800">Penalidades aplicadas</h5>
                    <ul className="mt-2 space-y-1 text-xs text-red-700">
                      {p.penalidades.map((pen) => (
                        <li key={pen.id}>
                          • {pen.tipo.replace(/_/g, " ")}{" "}
                          {pen.valor && <>· {brl(pen.valor)}</>}
                          {pen.duracaoMeses && <> · {pen.duracaoMeses} meses</>}
                          {" · "}
                          {pen.dataAplicacao.toLocaleDateString("pt-BR")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!p.arquivado && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <details className="rounded-md border border-slate-200 bg-slate-50 p-2">
                      <summary className="cursor-pointer text-xs font-medium text-slate-700">+ Avançar fase</summary>
                      <form action={avancarProcedimentoAction} className="mt-2 grid gap-2 text-sm">
                        <input type="hidden" name="procedimentoId" value={p.id} />
                        <select name="fase" required className="rounded border border-slate-300 px-2 py-1 text-xs">
                          {Object.entries(ROTULO_FASE).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          name="dataEvento"
                          defaultValue={new Date().toISOString().slice(0, 10)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          name="descricao"
                          placeholder="Descrição (opcional)"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <button type="submit" className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                          Adicionar fase
                        </button>
                      </form>
                    </details>

                    <details className="rounded-md border border-red-200 bg-red-50/30 p-2">
                      <summary className="cursor-pointer text-xs font-medium text-red-800">+ Aplicar penalidade</summary>
                      <form action={aplicarPenalidadeAction} className="mt-2 grid gap-2 text-sm">
                        <input type="hidden" name="procedimentoId" value={p.id} />
                        <select name="tipo" required className="rounded border border-slate-300 px-2 py-1 text-xs">
                          <option value="ADVERTENCIA">Advertência</option>
                          <option value="MULTA">Multa</option>
                          <option value="IMPEDIMENTO_LICITAR">Impedimento de licitar</option>
                          <option value="DECLARACAO_INIDONEIDADE">Declaração de inidoneidade</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          name="valor"
                          placeholder="Valor da multa (R$)"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          name="duracaoMeses"
                          placeholder="Duração em meses"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          name="dataAplicacao"
                          defaultValue={new Date().toISOString().slice(0, 10)}
                          required
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <textarea
                          name="fundamentacao"
                          placeholder="Fundamentação"
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          rows={2}
                        />
                        <button type="submit" className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white">
                          Aplicar
                        </button>
                      </form>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <details className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">+ Abrir procedimento apuratório</summary>
        <form action={formAction} className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {ataId && <input type="hidden" name="ataId" value={ataId} />}
          {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
          {empenhoId && <input type="hidden" name="empenhoId" value={empenhoId} />}
          <Campo label="Número (opcional)" name="numero" />
          <Campo label="Notificação prévia (nº)" name="notificacaoNumero" />
          <Campo label="Assunto" name="assunto" required colSpan={2} />
          <Campo label="Descrição" name="descricao" required colSpan={2} />
          <Campo label="Comissão" name="comissao" />
          <Campo label="Autoridade competente" name="autoridade" />
          <Campo label="Data de abertura" name="dataAbertura" type="date" required />
          <div />
          <Campo label="Prazo defesa (dias, padrão 15)" name="prazoDefesaDias" type="number" defaultValue={15} />
          <Campo label="Prazo recurso (dias, padrão 15)" name="prazoRecursoDias" type="number" defaultValue={15} />
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Arquivo</span>
            <input type="file" name="arquivo" accept="application/pdf" className="text-xs" />
          </label>
          {state?.erro && <div className="col-span-2 text-xs text-red-700">{state.erro}</div>}
          {state?.ok && <div className="col-span-2 text-xs text-emerald-700">Procedimento aberto.</div>}
          <button type="submit" className="col-span-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
            Abrir procedimento
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
