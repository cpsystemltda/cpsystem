import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  erro?: string;
  span?: 1 | 2 | 3 | 4;
};

export function Field({ label, erro, span = 2, className, ...rest }: FieldProps) {
  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";
  return (
    <label className={`flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        className={`rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
          erro ? "border-red-400 focus:border-red-400" : "border-slate-300 focus:border-blue-500"
        } ${className ?? ""}`}
      />
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  erro?: string;
  span?: 1 | 2 | 3 | 4;
  options: { value: string; label: string }[];
};

export function Select({ label, erro, span = 2, options, className, ...rest }: SelectProps) {
  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";
  return (
    <label className={`flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        {...rest}
        className={`rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
          erro ? "border-red-400" : "border-slate-300 focus:border-blue-500"
        } ${className ?? ""}`}
      >
        <option value="">Selecione…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </label>
  );
}
