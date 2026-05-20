"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

// Ícone "?" ao lado do label de um campo. Hover OU clique (mobile) abre
// um popover com texto explicativo. Usado pra reduzir dúvida em campos
// jurídico/técnicos (CNAE, Natureza Jurídica, Tipo de Contrato, etc.).
//
// Uso:
//   <label>
//     CNAE principal <TooltipAjuda texto="Código da atividade econômica..." />
//   </label>
export function TooltipAjuda({
  texto,
  titulo,
  tamanho = "sm",
}: {
  texto: string;
  titulo?: string;
  tamanho?: "sm" | "md";
}) {
  const [aberto, setAberto] = useState(false);
  const refContainer = useRef<HTMLSpanElement>(null);

  // Fecha quando clica fora (útil pro modo clique/mobile)
  useEffect(() => {
    if (!aberto) return;
    function handler(ev: MouseEvent) {
      if (refContainer.current && !refContainer.current.contains(ev.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aberto]);

  const tamanhoIcone = tamanho === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      ref={refContainer}
      className="relative inline-flex items-center"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        onClick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setAberto((v) => !v);
        }}
        aria-label="Ajuda sobre este campo"
        aria-expanded={aberto}
        className="inline-flex items-center justify-center rounded-full text-slate-400 hover:text-violet-600 transition focus:outline-none focus:ring-2 focus:ring-violet-300"
        tabIndex={0}
      >
        <HelpCircle className={tamanhoIcone} />
      </button>
      {aberto && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 w-[260px] max-w-[min(280px,80vw)] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-snug text-slate-700 shadow-lg"
          style={{ boxShadow: "0 8px 24px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.08)" }}
        >
          {titulo && (
            <span className="block mb-1 font-bold text-slate-900">{titulo}</span>
          )}
          <span className="block whitespace-pre-line">{texto}</span>
          {/* Setinha apontando pro ícone */}
          <span
            className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px"
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "6px solid white",
              filter: "drop-shadow(0 -1px 0 rgb(226 232 240))",
            }}
            aria-hidden
          />
        </span>
      )}
    </span>
  );
}
