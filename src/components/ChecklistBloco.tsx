"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, FileText, Paperclip, RefreshCw, X } from "lucide-react";
import { ROTULO_STATUS_ITEM, STATUS_ITEM, situacaoChecklist, type StatusItemChecklist } from "@/lib/checklistMensal";
import { AVISO_SEM_DADOS_DE_SAUDE } from "@/lib/lgpd";
import { dataBrDia } from "@/lib/competencias";
import type { ItemChecklistDto } from "@/lib/checklistMensalServer";
import { atualizarItemChecklistAction, montarChecklistAction, reaproveitarCertidaoAction, removerAnexoItemAction } from "@/app/actions/checklistMensal";
import { useFormAction } from "@/lib/useFormAction";

/**
 * Bloco "Comprovação mensal" da competência (ESP-009): os documentos que o
 * órgão exige para pagar, com status, anexos, prazo e validade. Quando todos
 * os obrigatórios estão enviados, a etapa "Documentação trabalhista enviada"
 * é marcada sozinha (RN05).
 */

export type CertidaoOpcao = { id: string; validade: string; competencia: string; contratoNumero: string; anexos: { nome: string }[] };

const COR: Record<StatusItemChecklist, string> = {
  PENDENTE: "bg-slate-100 text-slate-700",
  ANEXADO: "bg-sky-100 text-sky-800",
  ENVIADO: "bg-violet-100 text-violet-800",
  ACEITO: "bg-emerald-100 text-emerald-800",
  DEVOLVIDO: "bg-red-100 text-red-800",
};

export function ChecklistBloco({
  competenciaId,
  itens,
  certidoes,
  podeEditar,
  hojeIso,
  onAviso,
}: {
  competenciaId: string;
  itens: ItemChecklistDto[];
  certidoes: Record<string, CertidaoOpcao[]>;
  podeEditar: boolean;
  hojeIso: string;
  onAviso: (m: string) => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(null);
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const s = situacaoChecklist(itens);

  function rodar(fn: () => Promise<{ ok?: boolean; erro?: string; mensagem?: string } | null>) {
    setErro(null);
    start(async () => {
      const r = await fn();
      if (r?.erro) setErro(r.erro);
      else {
        if (r?.mensagem) onAviso(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Comprovação mensal</h2>
          <p className="text-xs text-slate-500">
            Documentos que o órgão exige para pagar (Lei 14.133, art. 50 / IN 5/2017).{" "}
            {itens.length === 0 ? "Checklist ainda não montado." : s.completo ? <strong className="text-emerald-700">Todos os obrigatórios enviados.</strong> : <strong className="text-slate-800">{s.obrigatorios - s.pendentes} de {s.obrigatorios} obrigatórios enviados.</strong>}
          </p>
        </div>
        {podeEditar && (
          <button type="button" className="btn-secondary inline-flex" disabled={pendente} onClick={() => rodar(() => montarChecklistAction(competenciaId))} title="Acrescenta itens do modelo do contrato que ainda não estão aqui">
            <RefreshCw className="h-4 w-4" /> {itens.length === 0 ? "Montar checklist" : "Sincronizar com o modelo"}
          </button>
        )}
      </header>
      {erro && <p className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}
      {itens.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">Nenhum item. Use “Montar checklist” para trazer os itens do modelo do contrato (aba Checklist).</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {itens.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {i.nome}
                    {i.obrigatorio ? <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">obrigatório</span> : <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">opcional</span>}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR[i.status]}`}>{ROTULO_STATUS_ITEM[i.status]}</span>
                    {i.reaproveitado && <span className="ml-2 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800">reaproveitada</span>}
                  </p>
                  <p className="text-xs text-slate-600">
                    {i.prazo && (
                      <span className={i.atrasado ? "font-semibold text-red-700" : ""}>
                        prazo {dataBrDia(i.prazo)}
                        {i.atrasado ? " (atrasado)" : ""}
                      </span>
                    )}
                    {i.temValidade && i.validade && <span className="ml-2">válida até {dataBrDia(i.validade)}</span>}
                    {i.alertaValidade && (
                      <span className="ml-2 inline-flex items-center gap-1 text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> {i.alertaValidade.tipo === "VENCIDA" ? `vencida há ${i.alertaValidade.dias} dia(s)` : `vence em ${i.alertaValidade.dias} dia(s)`}
                      </span>
                    )}
                    {i.dataEnvio && <span className="ml-2">enviado em {dataBrDia(i.dataEnvio)}</span>}
                    {i.motivoDevolucao && <span className="ml-2 text-red-700">devolvido: {i.motivoDevolucao}</span>}
                    {i.observacao && <span className="ml-2 text-slate-500">· {i.observacao}</span>}
                  </p>
                  {i.anexos.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-2 text-xs">
                      {i.anexos.map((a) => (
                        <span key={a.url} className="inline-flex items-center gap-1">
                          <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                            <FileText className="h-3 w-3" /> {a.nome}
                          </a>
                          {podeEditar && (
                            <button type="button" className="text-slate-400 hover:text-red-600" aria-label="Remover anexo" disabled={pendente} onClick={() => confirm("Remover este anexo?") && rodar(() => removerAnexoItemAction(i.id, a.url))}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                {podeEditar && (
                  <button type="button" className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50" onClick={() => setAberto(aberto === i.id ? null : i.id)}>
                    <Paperclip className="h-3.5 w-3.5" /> {aberto === i.id ? "fechar" : "atualizar"}
                  </button>
                )}
              </div>
              {aberto === i.id && podeEditar && (
                <FormItem item={i} certidoes={certidoes[i.codigo] ?? []} hojeIso={hojeIso} onOk={(m) => { setAberto(null); onAviso(m); router.refresh(); }} onReaproveitar={(origemId) => rodar(() => reaproveitarCertidaoAction(i.id, origemId))} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormItem({ item, certidoes, hojeIso, onOk, onReaproveitar }: { item: ItemChecklistDto; certidoes: CertidaoOpcao[]; hojeIso: string; onOk: (m: string) => void; onReaproveitar: (origemId: string) => void }) {
  const { state, onSubmit, pending } = useFormAction<{ ok?: boolean; erro?: string; mensagem?: string } | null>(atualizarItemChecklistAction, (r) => onOk(r.mensagem ?? "Item atualizado."));
  const [status, setStatus] = useState<StatusItemChecklist>(item.status);
  return (
    <form onSubmit={onSubmit} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="itemId" value={item.id} />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Status</span>
          <select name="status" className="mt-1 w-full" value={status} onChange={(e) => setStatus(e.target.value as StatusItemChecklist)}>
            {STATUS_ITEM.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS_ITEM[s]}
              </option>
            ))}
          </select>
        </label>
        {(status === "ENVIADO" || status === "ACEITO") && (
          <label className="block text-xs">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Data de envio</span>
            <input name="dataEnvio" type="date" className="mt-1 w-full" defaultValue={item.dataEnvio?.slice(0, 10) ?? hojeIso} />
          </label>
        )}
        {item.temValidade && (
          <label className="block text-xs">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Válida até</span>
            <input name="validade" type="date" className="mt-1 w-full" defaultValue={item.validade?.slice(0, 10) ?? ""} />
          </label>
        )}
        {status === "DEVOLVIDO" && (
          <label className="block text-xs sm:col-span-2">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Motivo da devolução (do órgão)</span>
            <input name="motivoDevolucao" required className="mt-1 w-full" defaultValue={item.motivoDevolucao ?? ""} />
          </label>
        )}
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Anexar (PDF/imagem, vários)</span>
          <input name="arquivos" type="file" multiple accept="application/pdf,image/png,image/jpeg" className="mt-1 w-full text-xs" />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Observação</span>
          <input name="observacao" className="mt-1 w-full" defaultValue={item.observacao ?? ""} />
        </label>
      </div>
      {item.temValidade && certidoes.length > 0 && (
        <p className="mt-2 text-xs text-slate-600">
          Reaproveitar certidão já anexada:{" "}
          {certidoes.map((c) => (
            <button key={c.id} type="button" className="mr-2 text-blue-700 underline" onClick={() => onReaproveitar(c.id)}>
              {c.contratoNumero} · {c.competencia} (válida até {dataBrDia(c.validade)})
            </button>
          ))}
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-500">{AVISO_SEM_DADOS_DE_SAUDE}</p>
      {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
      <div className="mt-3 flex justify-end">
        <button type="submit" className="btn-primary inline-flex" disabled={pending}>
          <Check className="h-4 w-4" /> {pending ? "Salvando…" : "Salvar item"}
        </button>
      </div>
    </form>
  );
}
