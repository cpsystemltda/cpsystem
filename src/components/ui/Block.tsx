"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// Bloco do dashboard com cabecalho colapsavel. Igor (05/06) pediu via
// video pra que cada modulo (Financeiro, Atas & Contratos, etc) pudesse
// ser recolhido por uma setinha — ficando so a faixa do titulo e os
// modulos seguintes subindo. Estado guardado no client (sem persistencia
// entre recargas — Igor nao pediu).
export function Block({
  numero,
  eyebrow,
  titulo,
  tag,
  children,
  inicialmenteAberto = false,
}: {
  numero: string;
  eyebrow: string;
  titulo: ReactNode;
  tag?: string;
  children: ReactNode;
  /** Default e recolhido (Regina 05/06) — clica no header pra expandir. */
  inicialmenteAberto?: boolean;
}) {
  const [aberto, setAberto] = useState(inicialmenteAberto);
  return (
    <section className="glass mb-4 overflow-hidden rounded-[24px]">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="relative z-[1] flex w-full items-center justify-between gap-4 px-7 pb-4 pt-5 text-left transition hover:bg-[rgba(15,14,12,0.02)]"
        style={
          aberto
            ? { borderBottom: "0.5px solid var(--hairline)" }
            : undefined
        }
      >
        <div className="flex items-center gap-4">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-extrabold"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.35), rgba(212,175,55,0.10))",
              border: "0.5px solid rgba(168,137,71,0.5)",
              color: "var(--primary-deep)",
              letterSpacing: "-0.04em",
              boxShadow: "0 0 16px rgba(212,175,55,0.12)",
            }}
          >
            {numero}
          </div>
          <div>
            <div
              className="mb-1 text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.24em", color: "var(--primary-deep)" }}
            >
              {eyebrow}
            </div>
            <h2
              className="text-[24px] font-extrabold leading-[1.05]"
              style={{ color: "var(--text)", letterSpacing: "-0.04em" }}
            >
              {titulo}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tag && (
            <span
              className="rounded-full px-3.5 py-1.5 text-[9px] font-extrabold uppercase"
              style={{
                letterSpacing: "0.18em",
                color: "#0A0A0A",
                background: "var(--primary)",
                border: "0.5px solid rgba(168,137,71,0.5)",
                boxShadow: "0 4px 16px rgba(212,175,55,0.25)",
              }}
            >
              {tag}
            </span>
          )}
          <ChevronDown
            className="h-5 w-5 transition-transform"
            style={{
              color: "var(--primary-deep)",
              transform: aberto ? "rotate(0deg)" : "rotate(-90deg)",
            }}
            aria-hidden="true"
          />
        </div>
      </button>
      {aberto && <div className="relative z-[1] px-7 pb-6 pt-5">{children}</div>}
    </section>
  );
}
