"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";

function mascararTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Props = {
  defaultValue?: string;
  erro?: string;
  name?: string;
  label?: string;
  required?: boolean;
  span?: 1 | 2 | 3 | 4;
  placeholder?: string;
};

export function CampoTelefone({
  defaultValue = "",
  erro,
  name = "telefone",
  label = "Telefone",
  required = true,
  span = 2,
  placeholder = "(61) 9 9999-9999",
}: Props) {
  const [valor, setValor] = useState(mascararTelefone(defaultValue));

  useEffect(() => {
    setValor(mascararTelefone(defaultValue));
  }, [defaultValue]);

  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";

  return (
    <label className={`flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name={name}
          value={valor}
          onChange={(e) => setValor(mascararTelefone(e.target.value))}
          required={required}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="tel"
          maxLength={16}
          className={`w-full rounded-md border bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
            erro ? "border-red-400 focus:border-red-400" : "border-slate-300 focus:border-blue-500"
          }`}
        />
      </div>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </label>
  );
}
