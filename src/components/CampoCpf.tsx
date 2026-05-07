"use client";

import { useEffect, useState } from "react";

function mascararCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

type Props = {
  defaultValue?: string;
  erro?: string;
  name?: string;
  label?: string;
  required?: boolean;
  span?: 1 | 2 | 3 | 4;
};

export function CampoCpf({
  defaultValue = "",
  erro,
  name = "cpf",
  label = "CPF",
  required = true,
  span = 1,
}: Props) {
  const [valor, setValor] = useState(mascararCpf(defaultValue));

  useEffect(() => {
    setValor(mascararCpf(defaultValue));
  }, [defaultValue]);

  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";

  return (
    <label className={`flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        name={name}
        value={valor}
        onChange={(e) => setValor(mascararCpf(e.target.value))}
        required={required}
        placeholder="000.000.000-00"
        inputMode="numeric"
        autoComplete="off"
        maxLength={14}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
          erro ? "border-red-400 focus:border-red-400" : "border-slate-300 focus:border-blue-500"
        }`}
      />
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </label>
  );
}
