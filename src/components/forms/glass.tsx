"use client";

// Inputs estilo Liquid Glass — compartilhados entre NovaAtaForm, NovoContratoForm
// e (futuramente) NovoEmpenhoForm. Centraliza visual e comportamento (máscara
// de CNPJ, lookup ViaCEP, badge AUTO de IA, validação de DV do CNPJ).

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatarCnpjInput, formatarCepInput, validarCnpj } from "./vigencia";

// Chip pequeno "AUTO" pra marcar campos preenchidos pela IA. Usuário pode
// editar normalmente — quando edita, o chip some (camposAuto.delete).
export function BadgeAuto() {
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-extrabold"
      style={{
        background: "rgba(212,175,55,0.22)",
        border: "0.5px solid rgba(168,137,71,0.5)",
        color: "var(--primary-deep)",
        letterSpacing: "0.06em",
      }}
      title="Preenchido pela IA — revise antes de salvar"
    >
      AUTO
    </span>
  );
}

export function FieldGlass({
  label,
  name,
  type = "text",
  placeholder,
  required,
  erro,
  defaultValue,
  span = 1,
  value,
  onChange,
  onBlur,
  disabled,
  helper,
  auto,
}: {
  label: string;
  name?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  erro?: string;
  defaultValue?: string | number;
  span?: 1 | 2 | 3 | 4;
  value?: string;
  onChange?: (v: string) => void;
  onBlur?: (v: string) => void;
  disabled?: boolean;
  helper?: string;
  auto?: boolean;
}) {
  const colSpan = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" }[span];
  return (
    <label className={`${colSpan} block`}>
      <span
        className="mb-1.5 flex items-end gap-2 text-[11px] font-bold uppercase"
        style={{
          letterSpacing: "0.16em",
          color: "var(--text-mute)",
          minHeight: "30px",
          lineHeight: "1.25",
        }}
      >
        <span>
          {label}
          {required && <span style={{ color: "var(--primary)" }}> *</span>}
        </span>
        {auto && <BadgeAuto />}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
        disabled={disabled}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium"
      />
      {helper && (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-mute)" }}>
          {helper}
        </span>
      )}
      {erro && (
        <span className="mt-1 block text-[12px] font-semibold" style={{ color: "var(--coral)" }}>
          {erro}
        </span>
      )}
    </label>
  );
}

/**
 * Textarea com auto-resize. Usada no campo "Objeto" (descrição longa).
 * - min-height = 3 linhas
 * - cresce conforme o conteúdo (sem scroll vertical)
 * - largura cheia da seção (span=4 default)
 */
export function TextareaGlass({
  label,
  name,
  placeholder,
  required,
  erro,
  defaultValue,
  span = 4,
  helper,
  minRows = 3,
  auto,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  erro?: string;
  defaultValue?: string;
  span?: 1 | 2 | 3 | 4;
  helper?: string;
  minRows?: number;
  auto?: boolean;
}) {
  const colSpan = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" }[span];
  const ref = useRef<HTMLTextAreaElement>(null);
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }
  useEffect(() => {
    if (ref.current) autoResize(ref.current);
  }, []);
  return (
    <label className={`${colSpan} block`}>
      <span
        className="mb-1.5 flex items-end gap-2 text-[11px] font-bold uppercase"
        style={{
          letterSpacing: "0.16em",
          color: "var(--text-mute)",
          minHeight: "30px",
          lineHeight: "1.25",
        }}
      >
        <span>
          {label}
          {required && <span style={{ color: "var(--primary)" }}> *</span>}
        </span>
        {auto && <BadgeAuto />}
      </span>
      <textarea
        ref={ref}
        name={name}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        rows={minRows}
        onInput={(ev) => autoResize(ev.currentTarget)}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium leading-relaxed"
        style={{ resize: "vertical", overflow: "hidden", minHeight: `${minRows * 24 + 24}px` }}
      />
      {helper && (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-mute)" }}>
          {helper}
        </span>
      )}
      {erro && (
        <span className="mt-1 block text-[12px] font-semibold" style={{ color: "var(--coral)" }}>
          {erro}
        </span>
      )}
    </label>
  );
}

export function SelectGlass({
  label,
  name,
  options,
  required,
  erro,
  defaultValue,
  span = 1,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  erro?: string;
  defaultValue?: string;
  span?: 1 | 2 | 3 | 4;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const colSpan = { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" }[span];
  return (
    <label className={`${colSpan} block`}>
      <span
        className="mb-1.5 flex items-end text-[11px] font-bold uppercase"
        style={{
          letterSpacing: "0.16em",
          color: "var(--text-mute)",
          minHeight: "30px",
          lineHeight: "1.25",
        }}
      >
        <span>
          {label}
          {required && <span style={{ color: "var(--primary)" }}> *</span>}
        </span>
      </span>
      <select
        name={name}
        required={required}
        defaultValue={value === undefined ? defaultValue ?? "" : undefined}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-xl px-4 py-3 text-sm font-medium"
      >
        <option value="">— Selecione —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {erro && (
        <span className="mt-1 block text-[12px] font-semibold" style={{ color: "var(--coral)" }}>
          {erro}
        </span>
      )}
    </label>
  );
}

/* CNPJ controlado com máscara + validação de DV no onBlur (Lei 14.133 cap. I).
   Aceita CNPJ com ou sem máscara colado — limpa e reaplica. Erro inline
   aparece logo abaixo do input se o DV não bater. */
export function CnpjInput({
  label,
  name,
  required,
  erro,
  defaultValue,
  span = 2,
  auto,
}: {
  label: string;
  name: string;
  required?: boolean;
  erro?: string;
  defaultValue?: string;
  span?: 1 | 2 | 3 | 4;
  auto?: boolean;
}) {
  const [val, setVal] = useState(defaultValue ? formatarCnpjInput(defaultValue) : "");
  const [erroDV, setErroDV] = useState<string | null>(null);
  return (
    <FieldGlass
      label={label}
      name={name}
      placeholder="00.000.000/0000-00"
      required={required}
      erro={erro ?? erroDV ?? undefined}
      span={span}
      value={val}
      onChange={(v) => {
        setVal(formatarCnpjInput(v));
        // Limpa erro enquanto usuário ainda está digitando
        if (erroDV) setErroDV(null);
      }}
      onBlur={(v) => {
        const limpo = v.replace(/\D/g, "");
        if (limpo.length === 0) {
          setErroDV(null);
          return;
        }
        if (limpo.length !== 14 || !validarCnpj(limpo)) {
          setErroDV("CNPJ inválido — verifique os números.");
        } else {
          setErroDV(null);
        }
      }}
      auto={auto}
    />
  );
}

/* CEP com lookup automático ViaCEP — preenche logradouro/bairro/cidade/uf
   no callback `onResolve` quando os 8 dígitos forem digitados. */
export function CepInput({
  label,
  name,
  required,
  defaultValue,
  span = 1,
  onResolve,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  span?: 1 | 2 | 3 | 4;
  onResolve?: (data: { logradouro: string; bairro: string; cidade: string; uf: string }) => void;
}) {
  const [val, setVal] = useState(defaultValue ? formatarCepInput(defaultValue) : "");
  const [carregando, setCarregando] = useState(false);

  async function buscar(cepFmt: string) {
    const cep = cepFmt.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCarregando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data.erro && onResolve) {
        onResolve({
          logradouro: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          uf: data.uf || "",
        });
      }
    } catch {
      // ignora erro de rede — usuário preenche manual
    } finally {
      setCarregando(false);
    }
  }

  return (
    <label className={`col-span-${span} block`}>
      <span
        className="mb-1.5 flex items-end text-[11px] font-bold uppercase"
        style={{
          letterSpacing: "0.16em",
          color: "var(--text-mute)",
          minHeight: "30px",
          lineHeight: "1.25",
        }}
      >
        <span>
          {label}
          {required && <span style={{ color: "var(--primary)" }}> *</span>}
        </span>
      </span>
      <div className="relative">
        <input
          type="text"
          name={name}
          placeholder="00000-000"
          required={required}
          value={val}
          onChange={(e) => {
            const f = formatarCepInput(e.target.value);
            setVal(f);
            if (f.replace(/\D/g, "").length === 8) buscar(f);
          }}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium"
        />
        {carregando && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
            style={{ color: "var(--primary)" }}
          />
        )}
      </div>
    </label>
  );
}
