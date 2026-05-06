"use client";

import { useState } from "react";
import { Plus, X, Mail, Phone } from "lucide-react";

type Tipo = "email" | "telefone" | "texto";

type Props = {
  /** Nome base do campo (ex: "emailEmpresa"). Cada item vai como name="emailEmpresa[]" */
  name: string;
  label: string;
  defaultValues?: string[];
  tipo?: Tipo;
  required?: boolean;
  placeholder?: string;
  erro?: string;
  span?: 1 | 2 | 3 | 4;
  /** Quantos campos adicionais permitir (além do primeiro). Default 4 (5 total). */
  maxExtras?: number;
};

function mascararTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Campo "multi-valor" com botão + pra adicionar mais entradas (até maxExtras).
 * Submete como array (`name="X[]"`); o server faz formData.getAll("X[]").
 *
 * Tipo "telefone" aplica máscara automática (61) 99999-9999.
 * Tipo "email" usa <input type="email"> pra validação HTML5.
 */
export function CampoMultiplo({
  name,
  label,
  defaultValues = [],
  tipo = "texto",
  required = false,
  placeholder,
  erro,
  span = 2,
  maxExtras = 4,
}: Props) {
  const inicial = defaultValues.length > 0 ? defaultValues : [""];
  const [valores, setValores] = useState<string[]>(inicial);

  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";

  const Icone = tipo === "email" ? Mail : tipo === "telefone" ? Phone : null;
  const inputType = tipo === "email" ? "email" : "text";
  const inputMode = tipo === "telefone" ? ("numeric" as const) : tipo === "email" ? ("email" as const) : undefined;

  function atualizar(i: number, raw: string) {
    const novo = tipo === "telefone" ? mascararTelefone(raw) : raw;
    setValores((vs) => vs.map((v, idx) => (idx === i ? novo : v)));
  }

  function adicionar() {
    setValores((vs) => [...vs, ""]);
  }

  function remover(i: number) {
    setValores((vs) => (vs.length === 1 ? [""] : vs.filter((_, idx) => idx !== i)));
  }

  return (
    <div className={`flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="flex flex-col gap-2">
        {valores.map((v, i) => (
          <div key={i} className="flex gap-2">
            <div className="relative flex-1">
              {Icone && (
                <Icone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              )}
              <input
                type={inputType}
                inputMode={inputMode}
                name={`${name}[]`}
                value={v}
                onChange={(e) => atualizar(i, e.target.value)}
                required={required && i === 0}
                placeholder={placeholder}
                autoComplete={tipo === "email" ? "email" : tipo === "telefone" ? "tel" : "off"}
                className={`w-full rounded-md border bg-white py-2 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
                  Icone ? "pl-9" : "pl-3"
                } ${erro && i === 0 ? "border-red-400" : "border-slate-300 focus:border-blue-500"}`}
              />
            </div>
            {valores.length > 1 && (
              <button
                type="button"
                onClick={() => remover(i)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                title="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
        {valores.length <= maxExtras && (
          <button
            type="button"
            onClick={adicionar}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar mais {tipo === "email" ? "e-mail" : tipo === "telefone" ? "telefone" : "valor"}
          </button>
        )}
      </div>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
