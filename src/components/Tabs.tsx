"use client";

import { useState, type ReactNode } from "react";

export type Aba = { key: string; label: string; badge?: number; content: ReactNode };

export function Tabs({ abas, defaultKey }: { abas: Aba[]; defaultKey?: string }) {
  const [ativa, setAtiva] = useState(defaultKey || abas[0]?.key || "");
  const conteudo = abas.find((a) => a.key === ativa)?.content;

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {abas.map((a) => {
          const sel = a.key === ativa;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => setAtiva(a.key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                sel
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {a.label}
              {a.badge !== undefined && a.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    sel ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {a.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="pt-6">{conteudo}</div>
    </div>
  );
}
