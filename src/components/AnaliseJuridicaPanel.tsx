"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Sparkles,
  FileText,
  ClipboardList,
  Truck,
  AlertCircle,
  CheckCircle,
  Clock,
  Scale,
  Loader2,
} from "lucide-react";
import {
  analisarDocumentoJuridicoAction,
  type AnalisarDocumentoResult,
} from "@/app/actions/iaJuridica";
import type { AnaliseJuridica, TipoDocJuridico } from "@/lib/iaJuridica";

type Opcao = { id: string; rotulo: string };

const TIPOS: { value: TipoDocJuridico; label: string; icone: React.ComponentType<{ className?: string }>; }[] = [
  { value: "ATA", label: "Ata de Registro de Preços", icone: FileText },
  { value: "CONTRATO", label: "Contrato administrativo", icone: ClipboardList },
  { value: "EMPENHO", label: "Empenho / Instrumento art. 95", icone: Truck },
];

const COR_SEVERIDADE: Record<"alta" | "media" | "baixa", { bg: string; border: string; fg: string }> = {
  alta: { bg: "bg-red-50", border: "border-red-300", fg: "text-red-800" },
  media: { bg: "bg-amber-50", border: "border-amber-300", fg: "text-amber-800" },
  baixa: { bg: "bg-blue-50", border: "border-blue-300", fg: "text-blue-800" },
};

export function AnaliseJuridicaPanel({
  atas,
  contratos,
  empenhos,
}: {
  atas: Opcao[];
  contratos: Opcao[];
  empenhos: Opcao[];
}) {
  const [tipo, setTipo] = useState<TipoDocJuridico>("CONTRATO");
  const [documentoId, setDocumentoId] = useState("");
  const [resultado, setResultado] = useState<AnalisarDocumentoResult | null>(null);
  const [analisando, startTransition] = useTransition();

  const opcoes = useMemo(() => {
    if (tipo === "ATA") return atas;
    if (tipo === "CONTRATO") return contratos;
    return empenhos;
  }, [tipo, atas, contratos, empenhos]);

  function analisar() {
    if (!documentoId) return;
    setResultado(null);
    startTransition(async () => {
      const r = await analisarDocumentoJuridicoAction(tipo, documentoId);
      setResultado(r);
    });
  }

  return (
    <div className="space-y-5">
      {/* Seletor */}
      <div className="glass rounded-2xl px-6 py-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-600" />
          Analisar documento com IA
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Escolha o tipo e o documento — a IA gera um parecer estruturado em segundos
          (resumo, pontos críticos, checklist de gestão e janelas críticas de prazo).
        </p>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {TIPOS.map((t) => {
            const ativo = tipo === t.value;
            const Icone = t.icone;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTipo(t.value);
                  setDocumentoId("");
                  setResultado(null);
                }}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                  ativo
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                }`}
              >
                <Icone className={`h-4 w-4 shrink-0 ${ativo ? "text-violet-600" : "text-slate-500"}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={documentoId}
            onChange={(ev) => {
              setDocumentoId(ev.target.value);
              setResultado(null);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="">— Escolha o documento —</option>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={analisar}
            disabled={!documentoId || analisando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
          >
            {analisando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Analisar com IA
              </>
            )}
          </button>
        </div>

        {opcoes.length === 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nenhum documento desse tipo cadastrado ainda. Cadastre primeiro em Atas / Contratos / Fornecimento.
          </p>
        )}
      </div>

      {/* Resultado */}
      {resultado && resultado.ok && (
        <ResultadoAnalise analise={resultado.analise} />
      )}
      {resultado && !resultado.ok && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mr-1 inline-block h-4 w-4" /> {resultado.erro}
        </div>
      )}
    </div>
  );
}

function ResultadoAnalise({ analise }: { analise: AnaliseJuridica }) {
  return (
    <div className="space-y-4">
      {/* Resumo executivo */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "linear-gradient(135deg, rgba(142, 115, 224, 0.10), rgba(107, 79, 201, 0.04))",
          border: "0.5px solid rgba(142, 115, 224, 0.30)",
        }}
      >
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
          <Scale className="h-3.5 w-3.5" /> Resumo executivo
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{analise.resumoExecutivo}</p>
      </div>

      {/* Pontos críticos */}
      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Pontos críticos ({analise.pontosCriticos.length})
        </h4>
        <ul className="mt-3 space-y-2">
          {analise.pontosCriticos.map((p, i) => {
            const c = COR_SEVERIDADE[p.severidade];
            return (
              <li key={i} className={`rounded-xl border ${c.border} ${c.bg} px-3 py-2`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${c.fg}`}>{p.titulo}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.fg}`}
                    style={{ background: "rgba(255,255,255,0.6)" }}
                  >
                    {p.severidade}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-700">{p.descricao}</p>
              </li>
            );
          })}
          {analise.pontosCriticos.length === 0 && (
            <li className="text-xs text-slate-500">Nenhum ponto crítico identificado.</li>
          )}
        </ul>
      </div>

      {/* Checklist gestão */}
      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Checklist de gestão ({analise.checklistGestao.length})
        </h4>
        <ul className="mt-3 space-y-1.5">
          {analise.checklistGestao.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  c.concluido ? "text-emerald-600" : "text-slate-300"
                }`}
              />
              <span className={c.concluido ? "line-through text-slate-500" : ""}>{c.item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Janelas críticas */}
      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <Clock className="h-3.5 w-3.5 text-amber-600" /> Janelas críticas de prazo ({analise.janelasCriticas.length})
        </h4>
        <ul className="mt-3 space-y-2">
          {analise.janelasCriticas.map((j, i) => (
            <li
              key={i}
              className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-amber-900">{j.evento}</span>
                <span className="text-xs font-semibold text-amber-700">{j.prazo}</span>
              </div>
              <p className="mt-1 text-xs text-amber-800">{j.recomendacao}</p>
            </li>
          ))}
          {analise.janelasCriticas.length === 0 && (
            <li className="text-xs text-slate-500">Nenhuma janela de prazo destacada.</li>
          )}
        </ul>
      </div>

      <p className="text-[11px] text-slate-500">
        Parecer gerado por IA. Decisões críticas devem ser confirmadas com advogado da empresa.
      </p>
    </div>
  );
}
