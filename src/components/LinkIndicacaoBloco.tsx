"use client";

import { useState } from "react";
import { Copy, Share2, Check, Sparkles } from "lucide-react";

// Bloco do painel do analista com o link pessoal de indicacao.
// Cada analista tem uma URL propria (?ref=<analistaId>). Compartilha com
// cliente, e quando ele se cadastra por ali, fica vinculado automaticamente.
// Regina 07/07: R$ 29,90 fixo por vinculo ativo (recorrente vitalicio).
export function LinkIndicacaoBloco({
  analistaId,
  nomeAnalista,
}: {
  analistaId: string;
  nomeAnalista: string;
}) {
  const url = `https://cpsystem.app.br/signup?ref=${analistaId}`;
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      // ignora
    }
  }

  const primeiroNome = nomeAnalista.split(" ")[0] || nomeAnalista;
  const mensagemWa = encodeURIComponent(
    `Oi! Sou ${primeiroNome}, analista de licitações. Estou usando o CP System pra ` +
      `gestão pós-licitação (Lei 14.133/2021) — e recomendo pra você. Cadastre-se pelo meu ` +
      `link pra garantir acompanhamento:\n\n${url}`,
  );
  const waHref = `https://wa.me/?text=${mensagemWa}`;

  return (
    <section
      className="mt-6 rounded-[18px] p-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.06)), rgba(255,255,255,0.6)",
        border: "0.5px solid rgba(168,137,71,0.4)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--primary-deep)" }} />
          <p
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--primary-deep)" }}
          >
            Seu link pessoal · Programa de Analista Parceiro
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
          style={{
            letterSpacing: "0.14em",
            background: "rgba(212,175,55,0.28)",
            color: "var(--primary-deep)",
          }}
        >
          R$ 29,90 / vínculo
        </span>
      </div>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
        Compartilhe com empresas. Quando alguém se cadastra por esse link, você recebe
        <strong> R$ 29,90/mês</strong> por cliente ativo, todo mês, enquanto ele permanecer assinante.
      </p>

      <div
        className="mt-3 flex items-center gap-2 rounded-[12px] px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.7)", border: "0.5px solid var(--hairline)" }}
      >
        <code
          className="flex-1 truncate text-[13px]"
          style={{ color: "var(--text)", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
        >
          {url}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition"
          style={{
            background: copiado ? "#10B981" : "var(--primary-deep)",
            color: "white",
          }}
        >
          {copiado ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copiado!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </>
          )}
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
        >
          <Share2 className="h-3.5 w-3.5" /> WhatsApp
        </a>
      </div>
    </section>
  );
}
