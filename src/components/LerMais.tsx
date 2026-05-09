"use client";

import { useState } from "react";

/**
 * Texto longo com botão "Ler mais" / "Ler menos".
 * Trunca em N caracteres (default 140) e mostra inline o resto quando expandido.
 * Usa `text-wrap: pretty` pra evitar palavras órfãs na quebra.
 */
export function LerMais({ texto, limite = 140 }: { texto: string; limite?: number }) {
  const [aberto, setAberto] = useState(false);
  const precisaTruncar = texto.length > limite;

  if (!precisaTruncar) {
    return <span style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{texto}</span>;
  }

  const visivel = aberto ? texto : texto.slice(0, limite).trimEnd() + "…";

  return (
    <span style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
      {visivel}{" "}
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="font-bold underline transition hover:opacity-70"
        style={{ color: "var(--primary-deep)", whiteSpace: "nowrap" }}
      >
        {aberto ? "Ler menos" : "Ler mais"}
      </button>
    </span>
  );
}
