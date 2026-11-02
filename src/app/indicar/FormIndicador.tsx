"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { signupIndicadorAction } from "@/app/actions/indicacao";
import { Field, Select } from "@/components/Field";
import { CampoCpf } from "@/components/CampoCpf";
import { CampoTelefone } from "@/components/CampoTelefone";
import { SubmitButton } from "@/components/SubmitButton";
import { CamposAtribuicao } from "@/components/CamposAtribuicao";

const PIX_TIPOS = [
  { value: "CPF", label: "CPF" },
  { value: "EMAIL", label: "E-mail" },
  { value: "TELEFONE", label: "Celular" },
  { value: "ALEATORIA", label: "Chave aleatória" },
];

const ROTULO: Record<string, string> = {
  nome: "Nome completo",
  cpf: "CPF",
  email: "E-mail",
  telefone: "WhatsApp",
  cidade: "Cidade/UF",
  pix: "Chave PIX",
  senha: "Senha",
  confirmacaoSenha: "Confirmação de senha",
  aceiteTermos: "Aceite do contrato",
};

/**
 * Cadastro em uma tela só. Pede o mínimo que o programa precisa: quem é
 * (CPF), por onde falamos (WhatsApp) e onde o dinheiro entra (PIX).
 */
export function FormIndicador() {
  const [state, formAction] = useActionState(signupIndicadorAction, null);
  const e = state?.campos ?? {};
  const v = state?.valores ?? {};
  const erros = Object.entries(e);
  const resumoRef = useRef<HTMLDivElement>(null);
  const [pixTipo, setPixTipo] = useState<string>(v.pixTipo ?? "CPF");

  useEffect(() => {
    if (erros.length === 0) return;
    resumoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erros]);

  return (
    <form action={formAction} className="grid grid-cols-4 gap-4">
      <CamposAtribuicao />
      {(state?.erro || erros.length > 0) && (
        <div ref={resumoRef} className="col-span-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="font-semibold">{state?.erro ?? "Verifique os campos:"}</p>
              {erros.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {erros.map(([campo, msg]) => (
                    <li key={campo}><strong>{ROTULO[campo] ?? campo}</strong>: {msg}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <Field label="Nome completo" name="nome" required defaultValue={v.nome ?? ""} erro={e.nome} span={4} />
      <CampoCpf defaultValue={v.cpf ?? ""} erro={e.cpf} span={2} />
      <CampoTelefone label="WhatsApp" defaultValue={v.telefone ?? ""} erro={e.telefone} span={2} />
      <Field label="E-mail de acesso" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? ""} erro={e.email} span={2} />
      <Field label="Cidade/UF" name="cidade" required placeholder="ex.: Goiânia/GO" defaultValue={v.cidade ?? ""} erro={e.cidade} span={2} />

      <Select
        label="Tipo de chave PIX"
        name="pixTipo"
        options={PIX_TIPOS}
        defaultValue={pixTipo}
        erro={e.pixTipo}
        span={2}
        onChange={(ev) => setPixTipo((ev.target as HTMLSelectElement).value)}
      />
      <Field
        label="Chave PIX (onde a comissão entra)"
        name="pix"
        required
        placeholder={pixTipo === "EMAIL" ? "voce@dominio.com" : pixTipo === "TELEFONE" ? "(61) 9 9999-9999" : pixTipo === "CPF" ? "000.000.000-00" : "chave aleatória"}
        defaultValue={v.pix ?? ""}
        erro={e.pix}
        span={2}
      />
      <Field label="Senha (mín. 10 caracteres)" name="senha" type="password" autoComplete="new-password" required erro={e.senha} span={2} />
      <Field label="Confirmação de senha" name="confirmacaoSenha" type="password" autoComplete="new-password" required erro={e.confirmacaoSenha} span={2} />

      <div className="col-span-4 rounded-xl px-4 py-3" style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.4)" }}>
        <label className="flex items-start gap-2.5 text-[13px] text-[#2D3340]">
          <input type="checkbox" name="aceiteTermos" value="1" required className="mt-0.5" />
          <span>
            Li e aceito o{" "}
            <a href="/termos?tipo=analista" target="_blank" rel="noreferrer" className="font-bold underline text-[#9C7A2D]">
              Contrato de Adesão ao Programa de Analista Parceiro
            </a>
            , que rege também o papel de indicador: comissão de R$ 29,90 por empresa indicada com assinatura ativa, paga por PIX no dia 20 do mês seguinte, e as condutas vedadas.
          </span>
        </label>
        {e.aceiteTermos && <p className="mt-2 text-[11px] font-semibold text-[#BE123C]">{e.aceiteTermos}</p>}
      </div>

      <div className="col-span-4">
        <SubmitButton>Criar meu cupom de indicação · gratuito</SubmitButton>
      </div>
    </form>
  );
}
