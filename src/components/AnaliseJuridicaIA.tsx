"use client";

import { useState } from "react";
import { Sparkles, AlertTriangle, CheckCircle2, Clock, Loader2, X } from "lucide-react";
import { analisarContratoAction } from "@/app/actions/iaJuridica";
import type { AnaliseJuridica } from "@/lib/iaJuridica";

const SEVERIDADE_COR: Record<"alta" | "media" | "baixa", { bg: string; texto: string; borda: string; rotulo: string }> = {
  alta: { bg: "bg-red-50", texto: "text-red-900", borda: "border-red-200", rotulo: "Alta" },
  media: { bg: "bg-amber-50", texto: "text-amber-900", borda: "border-amber-200", rotulo: "Média" },
  baixa: { bg: "bg-slate-50", texto: "text-slate-700", borda: "border-slate-200", rotulo: "Baixa" },
};

export function AnaliseJuridicaIA({ contratoId }: { contratoId: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AnaliseJuridica | null>(null);
  const [demo, setDemo] = useState(false);
  const [aberto, setAberto] = useState(false);

  async function disparar() {
    setCarregando(true);
    setErro(null);
    const res = await analisarContratoAction(contratoId);
    setCarregando(false);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    setResultado(res.analise);
    setDemo(res.demo);
    setAberto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={disparar}
        disabled={carregando}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-blue-800 disabled:opacity-60"
      >
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {carregando ? "Analisando..." : "Análise jurídica IA"}
      </button>

      {erro && (
        <p className="ml-3 inline-flex items-center gap-1 text-xs text-red-700">
          <AlertTriangle className="h-3 w-3" /> {erro}
        </p>
      )}

      {aberto && resultado && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-6 backdrop-blur">
          <div className="relative my-8 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
                  <Sparkles className="h-3.5 w-3.5" /> Inteligência Jurídica Nativa
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">Análise jurídica do contrato</h3>
                {demo && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    Modo demonstração — configure ANTHROPIC_API_KEY para análise real.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Resumo executivo
                </h4>
                <p className="mt-2 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                  {resultado.resumoExecutivo}
                </p>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pontos críticos · defesa estratégica
                </h4>
                <div className="mt-2 space-y-2">
                  {resultado.pontosCriticos.map((p, i) => {
                    const cfg = SEVERIDADE_COR[p.severidade] || SEVERIDADE_COR.baixa;
                    return (
                      <div key={i} className={`rounded-lg border ${cfg.borda} ${cfg.bg} p-3`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm font-semibold ${cfg.texto}`}>{p.titulo}</p>
                          <span className={`shrink-0 rounded-full ${cfg.texto} bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase`}>
                            {cfg.rotulo}
                          </span>
                        </div>
                        <p className={`mt-1 text-xs leading-relaxed ${cfg.texto}/80`}>{p.descricao}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Checklist de gestão · compliance
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {resultado.checklistGestao.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-2.5 text-sm">
                      <CheckCircle2
                        className={`h-4 w-4 shrink-0 ${
                          c.concluido ? "text-emerald-600" : "text-slate-300"
                        }`}
                      />
                      <span className={c.concluido ? "text-slate-500 line-through" : "text-slate-700"}>
                        {c.item}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Janelas críticas de prazo
                </h4>
                <div className="mt-2 space-y-2">
                  {resultado.janelasCriticas.map((j, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-900">{j.evento}</p>
                        <p className="text-xs font-medium text-blue-800">Prazo: {j.prazo}</p>
                        <p className="mt-1 text-xs leading-relaxed text-blue-700">{j.recomendacao}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
                Esta análise foi gerada por <strong>Inteligência Jurídica Nativa</strong> (Claude
                Haiku 4.5 + base normativa Lei 14.133/2021). Use como apoio à decisão — para
                medidas judiciais ou administrativas formais, valide com o jurídico interno.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
