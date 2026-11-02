"use client";

import { useState } from "react";
import { Ticket, Copy, Check, Share2, MessageCircle } from "lucide-react";

/**
 * O cupom em destaque: código grande para ditar ao telefone, link para
 * mandar por mensagem, e os três gestos que a pessoa faz na vida real —
 * copiar o código, copiar o link, mandar no WhatsApp.
 */
export function CupomIndicacaoCard({
  codigo,
  link,
  diasTrial,
  nome,
}: {
  codigo: string;
  link: string;
  diasTrial: number;
  nome: string;
}) {
  const [copiado, setCopiado] = useState<"codigo" | "link" | null>(null);

  async function copiar(o: "codigo" | "link") {
    try {
      await navigator.clipboard.writeText(o === "codigo" ? codigo : link);
      setCopiado(o);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* navegador sem clipboard: o campo é selecionável */
    }
  }

  const primeiro = nome.split(" ")[0] || nome;
  const textoWa =
    `Olá! Conheço um sistema que acompanha ata, contrato e empenho depois da licitação e avisa no WhatsApp antes de o prazo vencer. ` +
    `Dá para testar ${diasTrial} dias sem cartão. Cadastre com o meu código *${codigo}* em ${link} — ${primeiro}`;

  async function compartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "CP System — gestão pós-licitação", text: textoWa, url: link });
        return;
      } catch {
        /* cancelou */
      }
    }
    copiar("link");
  }

  return (
    <div
      className="glass-tile relative overflow-hidden rounded-[22px] px-6 py-6"
      style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.14), rgba(212,175,55,0.04)), white", border: "0.5px solid rgba(168,137,71,0.45)" }}
    >
      <div className="flex flex-wrap items-start gap-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]" style={{ background: "linear-gradient(135deg, #B8860B, #D4AF37)", boxShadow: "0 6px 18px rgba(212,175,55,0.35)" }}>
          <Ticket className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase" style={{ letterSpacing: "0.22em", color: "var(--primary-deep)" }}>
            Seu cupom de indicação
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-xl border-2 border-dashed border-[#C9A33A] bg-white px-4 py-2 font-mono text-[28px] font-extrabold tracking-[0.12em] text-[#2D3340]">
              {codigo}
            </span>
            <button type="button" onClick={() => copiar("codigo")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white" style={{ background: copiado === "codigo" ? "var(--mint-deep)" : "linear-gradient(135deg, #B8860B, #D4AF37)" }}>
              {copiado === "codigo" ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar código</>}
            </button>
          </div>
          <p className="mt-2 text-[13.5px]" style={{ color: "var(--text-soft)" }}>
            A empresa informa este código no cadastro e ganha {diasTrial} dias de teste. A partir da{" "}
            <strong style={{ color: "var(--text)" }}>primeira fatura paga</strong>, R$ 29,90 por mês são seus, enquanto ela for cliente.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              readOnly
              value={link}
              onClick={(ev) => (ev.target as HTMLInputElement).select()}
              className="min-w-[260px] flex-1 rounded-lg border bg-white px-3 py-2 font-mono text-xs"
              style={{ borderColor: "var(--hairline)", color: "var(--text)" }}
              aria-label="Link do cupom"
            />
            <button type="button" onClick={() => copiar("link")} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50" style={{ borderColor: "var(--hairline)", color: "var(--text)" }}>
              {copiado === "link" ? <><Check className="h-3.5 w-3.5" /> Link copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar link</>}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(textoWa)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Mandar no WhatsApp
            </a>
            <button type="button" onClick={compartilhar} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50" style={{ borderColor: "var(--hairline)", color: "var(--text)" }}>
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
