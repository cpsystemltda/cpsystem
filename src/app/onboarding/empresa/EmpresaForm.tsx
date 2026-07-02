"use client";

import { useActionState } from "react";
import { confirmarEmpresaAction } from "@/app/actions/onboarding";

export function EmpresaForm({
  razaoSocial,
  nomeFantasia,
  email,
  telefones,
  responsavel,
}: {
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefones: string;
  responsavel: string;
}) {
  const [state, formAction, isPending] = useActionState(confirmarEmpresaAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <Campo label="Razão social" name="razaoSocial" defaultValue={razaoSocial} required />
      <Campo label="Nome fantasia" name="nomeFantasia" defaultValue={nomeFantasia} />
      <Campo label="E-mail da empresa" name="email" type="email" defaultValue={email} required />
      <Campo label="Telefones da empresa" name="telefones" defaultValue={telefones} placeholder="(00) 00000-0000" />
      <Campo label="Responsável na empresa" name="responsavel" defaultValue={responsavel} />

      {state?.erro && (
        <p className="text-sm font-semibold" style={{ color: "#BE123C" }}>{state.erro}</p>
      )}

      <div className="flex items-center gap-3 pt-4">
        <a
          href="/onboarding"
          className="text-xs font-bold uppercase transition hover:opacity-70"
          style={{ letterSpacing: "0.14em", color: "var(--text-soft)" }}
        >
          ← Voltar
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[13px] font-bold uppercase transition hover:scale-[1.02] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
            color: "#0A0A0A",
            letterSpacing: "0.18em",
          }}
        >
          {isPending ? "Salvando..." : "Continuar → Pagamento"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase" style={{ letterSpacing: "0.12em", color: "var(--text-soft)" }}>
        {label} {required && <span style={{ color: "#BE123C" }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl px-4 py-2.5 text-sm"
        style={{ background: "rgba(255,255,255,0.85)", border: "0.5px solid var(--hairline)", color: "var(--text)" }}
      />
    </div>
  );
}
