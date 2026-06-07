"use client";

import { useState } from "react";
import { Link2, Copy, Check, Share2 } from "lucide-react";

// Cartao destacado no painel do analista com o link pessoal de
// indicacao + botao copiar. Cada empresa que se cadastrar via
// /signup?ref=ANALISTA_ID conta como vinculo de embaixador.
export function LinkIndicacaoCard({
  analistaId,
  nomeCompleto,
}: {
  analistaId: string;
  nomeCompleto: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const link = typeof window !== "undefined"
    ? `${window.location.origin}/signup?ref=${analistaId}`
    : `/signup?ref=${analistaId}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback: selecionar input
      const inp = document.getElementById("link-indicacao-input") as HTMLInputElement | null;
      inp?.select();
    }
  }

  async function compartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "CP System — Gestão pós-licitação",
          text: `${nomeCompleto.split(" ")[0]} indica o CP System pra você: sistema completo de gestão pós-licitação sob a Lei 14.133. Cadastre-se com 14 dias de trial:`,
          url: link,
        });
      } catch {
        // usuario cancelou — ignora
      }
    } else {
      copiar();
    }
  }

  return (
    <div
      className="glass-tile relative overflow-hidden rounded-[20px] px-6 py-5"
      style={{
        background: "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04)), white",
        border: "0.5px solid rgba(168,137,71,0.4)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
          style={{
            background: "linear-gradient(135deg, #B8860B, #D4AF37)",
            boxShadow: "0 6px 18px rgba(212,175,55,0.35)",
          }}
        >
          <Link2 className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary-deep)" }}
          >
            Seu link pessoal de indicação
          </p>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-soft)" }}>
            Compartilhe com empresas que vendem ao governo. A partir da{" "}
            <strong style={{ color: "var(--text)" }}>1ª fatura paga</strong>, você ganha
            comissão recorrente — vitalícia.
          </p>

          <div className="mt-3 flex gap-2">
            <input
              id="link-indicacao-input"
              readOnly
              value={link}
              onClick={(ev) => (ev.target as HTMLInputElement).select()}
              className="flex-1 rounded-lg border bg-white px-3 py-2 text-xs font-mono"
              style={{ borderColor: "var(--hairline)", color: "var(--text)" }}
            />
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition"
              style={{
                background: copiado
                  ? "var(--mint-deep)"
                  : "linear-gradient(135deg, #B8860B, #D4AF37)",
              }}
              title="Copiar link"
            >
              {copiado ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </>
              )}
            </button>
            <button
              type="button"
              onClick={compartilhar}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold transition hover:bg-slate-50"
              style={{ borderColor: "var(--hairline)", color: "var(--text)" }}
              title="Compartilhar"
            >
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
