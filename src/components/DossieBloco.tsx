"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { dataBrDia } from "@/lib/competencias";
import { marcarDocPeloDossieAction } from "@/app/actions/dossie";

/**
 * Bloco "Dossiê do fiscal" da competência (ESP-010): PDF, ZIP com anexos e
 * quadro em Excel; aviso de pendências (gera mesmo assim, marcado
 * "incompleto"); histórico de gerações; marcar a etapa de documentação.
 */
export function DossieBloco({
  competenciaId,
  pendencias,
  docMarcada,
  podeEditar,
  hojeIso,
  historico,
  onAviso,
}: {
  competenciaId: string;
  pendencias: string[];
  docMarcada: boolean;
  podeEditar: boolean;
  hojeIso: string;
  historico: { id: string; versao: number; formato: string; incompleto: boolean; colaboradores: number; anexos: number; geradoEm: string; por: string | null }[];
  onAviso: (m: string) => void;
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const base = `/api/competencias/${competenciaId}/dossie`;
  function baixar(formato: string) {
    if (pendencias.length && !confirm(`Há ${pendencias.length} item(ns) obrigatório(s) pendente(s):\n\n${pendencias.join("\n")}\n\nGerar mesmo assim? A capa sai marcada como INCOMPLETO.`)) return;
    window.open(`${base}?formato=${formato}`, "_blank");
    setTimeout(() => router.refresh(), 2500);
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Dossiê do fiscal</h2>
      <p className="text-[11px] text-slate-500">O pacote para o fiscal atestar: capa, postos e alocação do mês (CPF mascarado), glosas, checklist e anexos.</p>
      {pendencias.length > 0 && (
        <p className="mt-2 inline-flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {pendencias.length} obrigatório(s) pendente(s): o dossiê sai marcado “incompleto”.
        </p>
      )}
      <div className="mt-3 grid gap-2">
        <button type="button" className="btn-primary inline-flex justify-center" onClick={() => baixar("pdf")}>
          <FileText className="h-4 w-4" /> Gerar dossiê (PDF)
        </button>
        <button type="button" className="btn-secondary inline-flex justify-center" onClick={() => baixar("zip")}>
          <FileArchive className="h-4 w-4" /> PDF + anexos (.zip)
        </button>
        <button type="button" className="btn-secondary inline-flex justify-center" onClick={() => baixar("xlsx")}>
          <FileSpreadsheet className="h-4 w-4" /> Quadro de colaboradores (Excel)
        </button>
        {podeEditar && !docMarcada && historico.length > 0 && (
          <button
            type="button"
            className="text-xs text-blue-700 hover:underline"
            disabled={pendente}
            onClick={() =>
              start(async () => {
                const r = await marcarDocPeloDossieAction(competenciaId, hojeIso);
                if (r?.erro) setErro(r.erro);
                else {
                  onAviso(r?.mensagem ?? "Etapa marcada.");
                  router.refresh();
                }
              })
            }
          >
            Marcar “Documentação trabalhista enviada” com o dossiê de hoje
          </button>
        )}
      </div>
      {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      {historico.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Gerações</p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
            {historico.map((h) => (
              <li key={h.id} className="flex items-center gap-1">
                <Download className="h-3 w-3 text-slate-400" /> v{h.versao} {h.formato} · {dataBrDia(h.geradoEm)} {new Date(h.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                {h.por ? ` · ${h.por}` : ""}
                {h.incompleto && <span className="rounded bg-red-50 px-1 text-red-700">incompleto</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
