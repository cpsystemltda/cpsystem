"use client";

import { useActionState } from "react";
import { atualizarPerfilAction } from "@/app/actions/perfil";

type Usuario = {
  nome: string;
  email: string;
  telefoneWhatsApp: string;
  cpf: string;
  cargo: string;
  dataNascimento: string;
};
type Empresa = {
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cep: string;
  telefones: string;
  email: string;
};
type Analista = {
  nomeCompleto: string;
  telefone: string;
  endereco: string;
  cep: string;
  complemento: string;
  pix: string;
  banco: string;
  agencia: string;
  contaCorrente: string;
};

export function PerfilForm({
  tipo,
  usuario,
  empresa,
  analista,
}: {
  tipo: "EMPRESA" | "ANALISTA";
  usuario: Usuario;
  empresa?: Empresa;
  analista?: Analista;
}) {
  const [state, formAction, pending] = useActionState(atualizarPerfilAction, null);
  const e = state?.campos ?? {};

  return (
    <form action={formAction} className="space-y-8">
      {/* Bloco: dados de acesso / pessoais */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Meus dados de acesso</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Campo label="Nome" name="nome" defaultValue={usuario.nome} erro={e.nome} />
          <Campo label="E-mail (não editável aqui)" name="email" defaultValue={usuario.email} disabled />
          <Campo label="WhatsApp (com DDD)" name="telefoneWhatsApp" defaultValue={usuario.telefoneWhatsApp} erro={e.telefoneWhatsApp} inputMode="numeric" placeholder="61999999999" />
          <Campo label="CPF" name="cpf" defaultValue={usuario.cpf} erro={e.cpf} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" />
          <Campo label="Cargo" name="cargo" defaultValue={usuario.cargo} />
          <Campo label="Data de nascimento" name="dataNascimento" type="date" defaultValue={usuario.dataNascimento} erro={e.dataNascimento} />
        </div>
      </section>

      {/* Bloco condicional: EMPRESA */}
      {tipo === "EMPRESA" && empresa && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Dados da empresa</h2>
          <p className="mt-1 text-xs text-slate-500">Empresa principal do cadastro. Se você tem múltiplos CNPJs, edite os demais em <a href="/empresas" className="underline">/empresas</a>.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Razão social" name="razaoSocial" defaultValue={empresa.razaoSocial} erro={e.razaoSocial} span={2} />
            <Campo label="CNPJ" name="cnpj" defaultValue={empresa.cnpj} erro={e.cnpj} inputMode="numeric" maxLength={18} />
            <Campo label="CEP" name="cep" defaultValue={empresa.cep} inputMode="numeric" maxLength={9} />
            <Campo label="Endereço completo" name="endereco" defaultValue={empresa.endereco} erro={e.endereco} span={2} />
            <Campo label="Telefones" name="telefones" defaultValue={empresa.telefones} />
            <Campo label="E-mail da empresa" name="emailEmpresa" defaultValue={empresa.email} erro={e.emailEmpresa} />
          </div>
        </section>
      )}

      {/* Bloco condicional: ANALISTA */}
      {tipo === "ANALISTA" && analista && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Dados do analista</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo label="Nome completo" name="analistaNomeCompleto" defaultValue={analista.nomeCompleto} span={2} />
            <Campo label="Telefone (com DDD)" name="analistaTelefone" defaultValue={analista.telefone} erro={e.analistaTelefone} inputMode="numeric" />
            <Campo label="CEP" name="analistaCep" defaultValue={analista.cep} inputMode="numeric" maxLength={9} />
            <Campo label="Endereço" name="analistaEndereco" defaultValue={analista.endereco} span={2} />
            <Campo label="Complemento" name="analistaComplemento" defaultValue={analista.complemento} />

            <div className="col-span-2 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
              <strong>Chave PIX obrigatória</strong> para receber sua comissão mensal (dia 20). Aceita CPF, e-mail, celular ou aleatória.
            </div>
            <Campo label="Chave PIX" name="analistaPix" defaultValue={analista.pix} erro={e.analistaPix} span={2} />
            <Campo label="Banco" name="analistaBanco" defaultValue={analista.banco} />
            <Campo label="Agência" name="analistaAgencia" defaultValue={analista.agencia} />
            <Campo label="Conta corrente" name="analistaContaCorrente" defaultValue={analista.contaCorrente} />
          </div>
        </section>
      )}

      {/* Confirmacao de senha */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">Confirmação de segurança</h2>
        <p className="mt-1 text-xs text-amber-900">Digite sua senha atual para confirmar as alterações. Alterações são registradas em auditoria.</p>
        <div className="mt-3">
          <label className="block text-xs font-semibold text-slate-700">
            Senha atual <span className="text-red-500">*</span>
            <input
              type="password"
              name="senhaAtual"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
            {e.senhaAtual && <p className="mt-1 text-[11px] font-semibold text-rose-700">{e.senhaAtual}</p>}
          </label>
        </div>
      </section>

      {state?.ok && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">✓ {state.detalhe}</div>
      )}
      {state?.erro && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">✕ {state.erro}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full px-6 py-3 text-[12px] font-bold uppercase tracking-widest transition hover:scale-[1.02] disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
            color: "#0A0A0A",
            letterSpacing: "0.18em",
          }}
        >
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

function Campo({
  label,
  name,
  defaultValue,
  erro,
  type,
  inputMode,
  maxLength,
  placeholder,
  disabled,
  span,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  erro?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "email" | "tel" | "search" | "url";
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  span?: 1 | 2;
}) {
  return (
    <label className={`text-xs font-semibold text-slate-700 ${span === 2 ? "sm:col-span-2" : ""}`}>
      {label}
      <input
        type={type ?? "text"}
        name={name}
        defaultValue={defaultValue}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        className={`mt-1 w-full rounded-md border ${erro ? "border-rose-400" : "border-slate-300"} bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 ${disabled ? "bg-slate-50 text-slate-500" : ""}`}
      />
      {erro && <p className="mt-1 text-[11px] font-semibold text-rose-700">{erro}</p>}
    </label>
  );
}
