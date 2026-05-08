import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  erro?: string;
  span?: 1 | 2 | 3 | 4;
  helper?: string;
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--text-mute)",
};

const inputStyle: React.CSSProperties = {
  borderRadius: "12px",
  padding: "12px 16px",
  fontSize: "14px",
  fontWeight: 500,
};

export function Field({ label, erro, span = 2, className, helper, ...rest }: FieldProps) {
  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";
  return (
    <label className={`flex flex-col gap-1.5 ${spanCls}`}>
      <span style={labelStyle}>
        {label}
        {rest.required && <span style={{ color: "var(--primary)" }}> *</span>}
      </span>
      <input
        {...rest}
        style={inputStyle}
        className={`outline-none transition ${
          erro ? "ring-2 ring-rose-300/50" : ""
        } ${className ?? ""}`}
      />
      {helper && !erro && (
        <span className="text-[11px]" style={{ color: "var(--text-mute)" }}>
          {helper}
        </span>
      )}
      {erro && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--coral)" }}>
          {erro}
        </span>
      )}
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  erro?: string;
  span?: 1 | 2 | 3 | 4;
  options: { value: string; label: string }[];
};

export function Select({ label, erro, span = 2, options, className, defaultValue, ...rest }: SelectProps) {
  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";
  // <select> uncontrolled só aplica defaultValue no primeiro mount.
  // Após server action retornar valores novos, forçamos remontagem via key.
  const selectKey = `${rest.name ?? "select"}-${String(defaultValue ?? "")}`;
  return (
    <label className={`flex flex-col gap-1.5 ${spanCls}`}>
      <span style={labelStyle}>
        {label}
        {rest.required && <span style={{ color: "var(--primary)" }}> *</span>}
      </span>
      <select
        key={selectKey}
        {...rest}
        defaultValue={defaultValue}
        style={inputStyle}
        className={`outline-none transition ${erro ? "ring-2 ring-rose-300/50" : ""} ${className ?? ""}`}
      >
        <option value="">— Selecione —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {erro && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--coral)" }}>
          {erro}
        </span>
      )}
    </label>
  );
}
