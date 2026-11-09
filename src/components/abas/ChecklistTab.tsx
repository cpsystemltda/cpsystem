"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ItemModeloDto } from "@/lib/checklistMensalServer";
import { dataBrDia } from "@/lib/competencias";
import { excluirItemModeloAction, salvarItemModeloAction } from "@/app/actions/checklistMensal";
import { useFormAction } from "@/lib/useFormAction";

/**
 * Aba "Checklist" do contrato de mão de obra (ESP-009 RN02): o modelo dos
 * documentos mensais exigidos pelo órgão. O que se edita aqui vale para as
 * competências seguintes.
 */
export function ChecklistTab({
  contratoId,
  modelo,
  indicador,
  alertas,
  podeEditar,
}: {
  contratoId: string;
  modelo: ItemModeloDto[];
  indicador: { completas: number; incompletas: number; semChecklist: number; diasMediosEnvio: number | null };
  alertas: { codigo: string; nome: string; validade: string; tipo: "VENCE_EM_BREVE" | "VENCIDA"; dias: number }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<ItemModeloDto | "novo" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Checklist mensal de comprovação</h3>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-600">
            Documentos que a empresa apresenta ao órgão em cada competência para receber (Lei 14.133, art. 50; IN 5/2017, Anexo VIII-B). Marque o que o órgão exige; a competência nasce com estes itens e, quando todos os obrigatórios são enviados, a etapa “Documentação trabalhista enviada” é marcada sozinha.
          </p>
        </div>
        {podeEditar && (
          <button type="button" className="btn-primary inline-flex" onClick={() => setEditando("novo")}>
            <Plus className="h-4 w-4" /> Item
          </button>
        )}
      </div>
      {aviso && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{aviso}</p>}
      {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{erro}</p>}

      {alertas.length > 0 && (
        <ul className="space-y-1.5">
          {alertas.map((a) => (
            <li key={a.codigo} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm ${a.tipo === "VENCIDA" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {a.nome}: {a.tipo === "VENCIDA" ? `vencida há ${a.dias} dia(s)` : `vence em ${a.dias} dia(s)`} ({dataBrDia(a.validade)}). Renove e anexe na competência corrente.
            </li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[
          ["Competências completas", String(indicador.completas)],
          ["Incompletas", String(indicador.incompletas)],
          ["Sem checklist", String(indicador.semChecklist)],
          ["Dias médios até o envio", indicador.diasMediosEnvio == null ? "—" : `${indicador.diasMediosEnvio} d`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      {editando && <FormModelo contratoId={contratoId} inicial={editando === "novo" ? null : editando} onFechar={() => setEditando(null)} onOk={(m) => { setEditando(null); setAviso(m); router.refresh(); }} />}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Documento</th>
              <th className="px-3 py-2 text-left font-semibold">Exigência</th>
              <th className="px-3 py-2 text-left font-semibold">Validade</th>
              <th className="px-3 py-2 text-left font-semibold">Prazo</th>
              <th className="px-3 py-2 text-left font-semibold">Ativo</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {modelo.map((m) => (
              <tr key={m.id} className={`border-t border-slate-100 ${m.ativo ? "" : "opacity-60"}`}>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{m.nome}</p>
                  {m.descricao && <p className="text-[11px] text-slate-500">{m.descricao}</p>}
                </td>
                <td className="px-3 py-2 text-xs">{m.obrigatorio ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">obrigatório</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">opcional</span>}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{m.temValidade ? "certidão (reaproveita enquanto válida)" : "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{m.prazoDiaMesSeguinte ? `dia ${m.prazoDiaMesSeguinte} do mês seguinte` : "—"}</td>
                <td className="px-3 py-2 text-xs">{m.ativo ? "sim" : "não"}</td>
                <td className="px-3 py-2 text-right">
                  {podeEditar && (
                    <span className="inline-flex gap-1">
                      <button type="button" className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Editar" onClick={() => setEditando(m)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                        aria-label="Remover"
                        disabled={pendente}
                        onClick={() =>
                          confirm(`Remover "${m.nome}" do modelo?`) &&
                          start(async () => {
                            const r = await excluirItemModeloAction(m.id);
                            if (r?.erro) setErro(r.erro);
                            else {
                              setAviso(r?.mensagem ?? "Removido.");
                              router.refresh();
                            }
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormModelo({ contratoId, inicial, onFechar, onOk }: { contratoId: string; inicial: ItemModeloDto | null; onFechar: () => void; onOk: (m: string) => void }) {
  const { state, onSubmit, pending } = useFormAction<{ ok?: boolean; erro?: string; mensagem?: string } | null>(salvarItemModeloAction, (r) => onOk(r.mensagem ?? "Salvo."));
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-violet-200 bg-white p-4">
      <input type="hidden" name="contratoId" value={contratoId} />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-slate-900">{inicial ? `Editar: ${inicial.nome}` : "Novo item do checklist"}</p>
        <button type="button" onClick={onFechar} aria-label="Fechar">
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Documento</span>
          <input name="nome" required className="mt-1 w-full" defaultValue={inicial?.nome ?? ""} />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Descrição / base legal</span>
          <input name="descricao" className="mt-1 w-full" defaultValue={inicial?.descricao ?? ""} />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Prazo (dia do mês seguinte)</span>
          <input name="prazoDiaMesSeguinte" inputMode="numeric" className="mt-1 w-full" defaultValue={inicial?.prazoDiaMesSeguinte?.toString() ?? ""} placeholder="ex.: 10" />
        </label>
        <label className="mt-5 inline-flex items-center gap-2 text-xs">
          <input type="checkbox" name="obrigatorio" value="1" defaultChecked={inicial?.obrigatorio ?? true} /> Obrigatório para o pagamento
        </label>
        <label className="mt-5 inline-flex items-center gap-2 text-xs">
          <input type="checkbox" name="temValidade" value="1" defaultChecked={inicial?.temValidade ?? false} /> Certidão com validade
        </label>
        <label className="mt-5 inline-flex items-center gap-2 text-xs">
          <input type="checkbox" name="ativo" value="1" defaultChecked={inicial?.ativo ?? true} onChange={(e) => { const h = e.currentTarget.form?.elements.namedItem("ativoHidden") as HTMLInputElement | null; if (h) h.value = e.currentTarget.checked ? "1" : "0"; }} /> Ativo (entra nas próximas competências)
          <input type="hidden" name="ativoHidden" value={inicial?.ativo === false ? "0" : "1"} />
        </label>
      </div>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onFechar}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
