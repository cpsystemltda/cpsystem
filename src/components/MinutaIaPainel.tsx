"use client";

/**
 * Painel modal de geração de minuta IA. Reutilizável: passa `tipo` +
 * `recursoId` + `rotulo` no botão; abre overlay com loading, mostra
 * a minuta gerada em markdown e oferece Copiar / Baixar .md.
 */

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  X,
  Copy,
  Check,
  Download,
  AlertCircle,
  Beaker,
  ScrollText,
} from "lucide-react";
import { gerarMinutaIaAction, type TipoMinuta } from "@/app/actions/iaMinutas";

export function BotaoGerarMinuta({
  tipo,
  recursoId,
  rotulo,
  variante = "primary",
}: {
  tipo: TipoMinuta;
  recursoId: string;
  rotulo: string;
  variante?: "primary" | "ghost";
}) {
  const [aberto, setAberto] = useState(false);

  const isPrimary = variante === "primary";
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          isPrimary
            ? "btn-primary inline-flex"
            : "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
        }
        style={
          isPrimary
            ? undefined
            : {
                background: "rgba(197,180,255,0.18)",
                color: "var(--lavender-deep, #6B5BB8)",
                border: "0.5px solid rgba(197,180,255,0.4)",
              }
        }
      >
        <Sparkles className="h-3.5 w-3.5" /> {rotulo}
      </button>
      {aberto && (
        <PainelMinutaModal
          tipo={tipo}
          recursoId={recursoId}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function PainelMinutaModal({
  tipo,
  recursoId,
  onFechar,
}: {
  tipo: TipoMinuta;
  recursoId: string;
  onFechar: () => void;
}) {
  const [estado, setEstado] = useState<
    | { fase: "INICIAL" }
    | { fase: "GERANDO" }
    | { fase: "OK"; minuta: string; titulo: string; demo: boolean }
    | { fase: "ERRO"; erro: string }
  >({ fase: "INICIAL" });
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    setEstado({ fase: "GERANDO" });
    const res = await gerarMinutaIaAction(tipo, recursoId);
    if (res.ok) setEstado({ fase: "OK", minuta: res.minuta, titulo: res.titulo, demo: res.demo });
    else setEstado({ fase: "ERRO", erro: res.erro });
  }

  function copiar() {
    if (estado.fase !== "OK") return;
    navigator.clipboard.writeText(estado.minuta);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function baixar() {
    if (estado.fase !== "OK") return;
    const blob = new Blob([estado.minuta], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${estado.titulo.replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(15,14,12,0.55)", backdropFilter: "blur(8px)" }}
      onClick={onFechar}
    >
      <div
        className="glass relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px]"
        onClick={(ev) => ev.stopPropagation()}
        style={{ background: "var(--glass-2)" }}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 px-7 py-5" style={{ borderBottom: "0.5px solid var(--border-soft)" }}>
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, var(--lavender), var(--sky))",
                boxShadow: "0 4px 16px rgba(197,180,255,0.4)",
              }}
            >
              <ScrollText className="h-5 w-5" style={{ color: "#0A0A0A" }} />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
                {ROTULO_TITULO[tipo]}
              </h3>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-mute)" }}>
                Minuta gerada pela IA — ponto de partida. Revise e ajuste antes de protocolar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="grid h-8 w-8 place-items-center rounded-full transition hover:opacity-80"
            style={{ background: "var(--glass-1)", color: "var(--text-soft)" }}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          {estado.fase === "INICIAL" && (
            <div className="py-8 text-center">
              <p className="text-[13px]" style={{ color: "var(--text-soft)" }}>
                A IA usará os dados deste {tipo === "PEDIDO_REAJUSTE" ? "contrato" : "procedimento"} pra
                redigir uma minuta com fundamentação na Lei 14.133/2021.
              </p>
              <button
                type="button"
                onClick={gerar}
                className="btn-primary mt-5 inline-flex"
              >
                <Sparkles className="h-4 w-4" /> Gerar minuta
              </button>
            </div>
          )}
          {estado.fase === "GERANDO" && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--primary)" }} />
              <p className="mt-3 text-[13px]" style={{ color: "var(--text-soft)" }}>
                Gerando minuta…
              </p>
            </div>
          )}
          {estado.fase === "ERRO" && (
            <div
              className="flex items-start gap-2 rounded-xl px-4 py-3 text-[13px]"
              style={{
                background: "rgba(232,138,152,0.10)",
                border: "0.5px solid rgba(232,138,152,0.3)",
                color: "var(--coral)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{estado.erro}</span>
            </div>
          )}
          {estado.fase === "OK" && (
            <div className="space-y-3">
              {estado.demo && (
                <div
                  className="flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]"
                  style={{
                    background: "rgba(212,175,55,0.10)",
                    border: "0.5px solid rgba(212,175,55,0.3)",
                    color: "var(--primary-deep)",
                  }}
                >
                  <Beaker className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>Modo demonstração</strong> — minuta de exemplo. Configure{" "}
                    <code>ANTHROPIC_API_KEY</code> pra geração real.
                  </span>
                </div>
              )}
              <pre
                className="whitespace-pre-wrap rounded-xl px-5 py-4 text-[13px] leading-relaxed"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  border: "0.5px solid var(--border-soft)",
                  color: "var(--text)",
                  fontFamily: "ui-serif, Georgia, Cambria, 'Times New Roman', serif",
                }}
              >
                {estado.minuta}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        {estado.fase === "OK" && (
          <footer
            className="flex items-center justify-between gap-3 px-7 py-4"
            style={{ background: "var(--glass-1)", borderTop: "0.5px solid var(--border-soft)" }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-mute)" }}>
              Revise antes de protocolar. Placeholders <code>[[...]]</code> precisam ser preenchidos.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:opacity-80"
                style={{
                  background: "var(--glass-2)",
                  color: "var(--text-soft)",
                  border: "0.5px solid var(--border-soft)",
                }}
              >
                {copiado ? (
                  <>
                    <Check className="h-3.5 w-3.5" style={{ color: "var(--mint)" }} /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={baixar}
                className="btn-primary inline-flex"
              >
                <Download className="h-4 w-4" /> Baixar .md
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

const ROTULO_TITULO: Record<TipoMinuta, string> = {
  PEDIDO_REAJUSTE: "Pedido de reajuste de preços",
  DEFESA_PROCEDIMENTO: "Defesa administrativa",
  RECURSO_PROCEDIMENTO: "Recurso administrativo",
};
