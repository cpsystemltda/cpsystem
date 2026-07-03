"use client";

import { useActionState, useState } from "react";
import { salvarDadosPessoaisAction } from "@/app/actions/onboarding";

export function DadosPessoaisForm({
  nome,
  cpf,
  cargo,
  telefone,
  dataNascimento,
}: {
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  dataNascimento: string;
}) {
  const [state, formAction, isPending] = useActionState(salvarDadosPessoaisAction, null);
  const campos = state?.campos ?? {};

  // Feedback ao vivo da confirmação de senha (positivo verde quando confere)
  // — evita o "Senhas não conferem" ficar gritando enquanto o usuário digita
  // (bug UX que confundiu o César no 1º acesso).
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const confereClientSide = senha.length >= 6 && senha === confirmacao;
  const confereFeedback =
    senha.length > 0 && confirmacao.length > 0
      ? senha === confirmacao
        ? "match"
        : "diff"
      : "vazio";

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Nome completo"
        name="nome"
        defaultValue={nome}
        erro={campos.nome}
        required
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="CPF"
          name="cpf"
          defaultValue={cpf}
          placeholder="000.000.000-00"
          erro={campos.cpf}
          required
        />
        <Field
          label="Data de nascimento"
          name="dataNascimento"
          type="date"
          defaultValue={dataNascimento}
          erro={campos.dataNascimento}
          required
        />
      </div>
      <Field
        label="Cargo na empresa"
        name="cargo"
        defaultValue={cargo}
        placeholder="Ex.: Sócio, Diretor, Gestor de contratos"
        erro={campos.cargo}
        required
      />
      <Field
        label="Seu WhatsApp (com DDD)"
        name="telefone"
        type="tel"
        defaultValue={telefone}
        placeholder="(61) 99999-9999"
        erro={campos.telefone}
        helper="Você vai receber alertas de prazo, entregas e relatório semanal aqui."
        required
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            className="mb-1 block text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.12em", color: "var(--text-soft)" }}
          >
            Nova senha <span style={{ color: "#BE123C" }}>*</span>
          </label>
          <input
            type="password"
            name="senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-xl px-4 py-2.5 text-sm"
            style={{
              background: "rgba(255,255,255,0.85)",
              border: campos.senha ? "1px solid #BE123C" : "0.5px solid var(--hairline)",
              color: "var(--text)",
            }}
          />
          {campos.senha ? (
            <p className="mt-1 text-[10px] font-semibold" style={{ color: "#BE123C" }}>
              {campos.senha}
            </p>
          ) : (
            <p className="mt-1 text-[10px]" style={{ color: "var(--text-mute)" }}>
              Mínimo 6 caracteres
            </p>
          )}
        </div>
        <div>
          <label
            className="mb-1 block text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.12em", color: "var(--text-soft)" }}
          >
            Confirmar senha <span style={{ color: "#BE123C" }}>*</span>
          </label>
          <input
            type="password"
            name="confirmacaoSenha"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            required
            className="w-full rounded-xl px-4 py-2.5 text-sm"
            style={{
              background: "rgba(255,255,255,0.85)",
              border:
                confereFeedback === "match"
                  ? "1px solid #2F8F4C"
                  : confereFeedback === "diff" && confirmacao.length >= senha.length
                    ? "1px solid #BE123C"
                    : "0.5px solid var(--hairline)",
              color: "var(--text)",
            }}
          />
          {confereFeedback === "match" && (
            <p className="mt-1 text-[10px] font-semibold" style={{ color: "#2F8F4C" }}>
              ✓ Senhas conferem
            </p>
          )}
          {confereFeedback === "diff" && confirmacao.length >= senha.length && (
            <p className="mt-1 text-[10px] font-semibold" style={{ color: "#BE123C" }}>
              Senhas não conferem
            </p>
          )}
        </div>
      </div>

      {/* Aceite obrigatório do contrato — Regina 03/07 */}
      <div
        className="mt-4 rounded-xl px-4 py-3"
        style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.4)" }}
      >
        <label className="flex items-start gap-2.5 text-[13px]" style={{ color: "var(--text)" }}>
          <input
            type="checkbox"
            name="aceiteTermos"
            value="1"
            required
            className="mt-0.5"
          />
          <span>
            Li e aceito o{" "}
            <a
              href="/termos"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline"
              style={{ color: "var(--primary-deep)" }}
            >
              Contrato de Prestação de Serviços & Termos de Uso
            </a>
            , autorizando notificações por WhatsApp e e-mail e o tratamento de
            dados pessoais conforme LGPD.
          </span>
        </label>
        {campos.aceiteTermos && (
          <p className="mt-2 text-[11px] font-semibold" style={{ color: "#BE123C" }}>
            {campos.aceiteTermos}
          </p>
        )}
      </div>

      {state?.erro && !campos && (
        <p className="text-sm font-semibold" style={{ color: "#BE123C" }}>
          {state.erro}
        </p>
      )}

      <div className="pt-4">
        <button
          type="submit"
          disabled={isPending || !confereClientSide}
          className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[13px] font-bold uppercase transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
            color: "#0A0A0A",
            letterSpacing: "0.18em",
            boxShadow: "0 10px 26px -6px rgba(168,137,71,0.4)",
          }}
        >
          {isPending ? "Salvando..." : "Continuar → Empresa"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  helper,
  erro,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  helper?: string;
  erro?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="mb-1 block text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.12em", color: "var(--text-soft)" }}
      >
        {label} {required && <span style={{ color: "#BE123C" }}>*</span>}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl px-4 py-2.5 text-sm"
        style={{
          background: "rgba(255,255,255,0.85)",
          border: erro ? "1px solid #BE123C" : "0.5px solid var(--hairline)",
          color: "var(--text)",
        }}
      />
      {erro && (
        <p className="mt-1 text-[10px] font-semibold" style={{ color: "#BE123C" }}>
          {erro}
        </p>
      )}
      {helper && !erro && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--text-mute)" }}>
          {helper}
        </p>
      )}
    </div>
  );
}
