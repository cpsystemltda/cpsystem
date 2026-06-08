"use client";

import { useState } from "react";
import { Link2, Copy, Check, Share2, Gift } from "lucide-react";

// Card no painel /conta/indicar com o link de referral cliente-cliente.
// Cada empresa que se cadastra via /signup?ref=conta-<id> e paga 1a fatura
// gera 1 mes gratis pra esta conta.

export function LinkIndicacaoClienteCard({ contaId }: { contaId: string }) {
  const [copiado, setCopiado] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=conta-${contaId}`
      : `/signup?ref=conta-${contaId}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      const inp = document.getElementById("link-indicacao-cliente-input") as
        | HTMLInputElement
        | null;
      inp?.select();
    }
  }

  async function compartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "CP System — gestão pós-licitação",
          text: "Indico o CP System pra você: sistema completo de gestão pós-licitação sob a Lei 14.133. Teste 14 dias grátis:",
          url: link,
        });
      } catch {
        // usuario cancelou
      }
    } else {
      copiar();
    }
  }

  return (
    <div
      className="glass-tile relative overflow-hidden rounded-[20px] px-6 py-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(93,216,182,0.10), rgba(93,216,182,0.04)), white",
        border: "0.5px solid rgba(93,216,182,0.3)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
          style={{
            background: "linear-gradient(135deg, var(--mint-deep), var(--mint))",
            boxShadow: "0 6px 18px rgba(93,216,182,0.3)",
          }}
        >
          <Gift className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--mint-deep)" }}
          >
            Seu link de indicação
          </p>
          <p className="mt-1 text-[14px]" style={{ color: "var(--text-soft)" }}>
            Compartilhe com empresas que vendem ao governo. Cada{" "}
            <strong>cadastro via seu link</strong> que pagar a{" "}
            <strong>1ª fatura</strong> = <strong>1 mês grátis</strong> pra você.
          </p>

          <div className="mt-3 flex gap-2">
            <input
              id="link-indicacao-cliente-input"
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
                  : "linear-gradient(135deg, var(--mint-deep), var(--mint))",
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

          <div className="mt-3 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-mute)" }}>
            <Link2 className="h-3 w-3" />
            <span>Sem limite de indicações. Cada pagante = 1 mês grátis no próximo ciclo.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
