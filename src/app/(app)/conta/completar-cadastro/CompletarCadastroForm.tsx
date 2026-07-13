"use client";

import { useActionState } from "react";
import { CampoCartao } from "@/components/CampoCartao";
import { completarCadastroAction } from "@/app/actions/completarCadastro";

export function CompletarCadastroForm({
  empresa,
  plano,
}: {
  empresa: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
    cep: string;
    telefones: string;
  };
  plano: string;
}) {
  const [state, formAction] = useActionState(completarCadastroAction, null);
  const e = state?.campos ?? {};

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600">
        <p><strong>Empresa:</strong> {empresa.razaoSocial}</p>
        <p><strong>CNPJ:</strong> {empresa.cnpj}</p>
        <p><strong>Plano contratado:</strong> {plano}</p>
      </div>

      <h2 className="border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Dados do cartão de crédito <span className="text-red-500">*</span>
      </h2>
      <CampoCartao
        erros={{
          cartaoNumero: e.cartaoNumero,
          cartaoValidade: e.cartaoValidade,
          cartaoCvv: e.cartaoCvv,
          cartaoNome: e.cartaoNome,
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700">
          CPF do titular do cartão <span className="text-red-500">*</span>
          <input
            name="cpfTitularCartao"
            type="text"
            required
            inputMode="numeric"
            maxLength={14}
            placeholder="000.000.000-00"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            onChange={(ev) => {
              const d = ev.target.value.replace(/\D/g, "").slice(0, 11);
              const f =
                d.length > 9 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
                : d.length > 6 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
                : d.length > 3 ? `${d.slice(0, 3)}.${d.slice(3)}` : d;
              ev.target.value = f;
            }}
          />
          {e.cpfTitularCartao && (
            <p className="mt-1 text-[11px] font-semibold text-rose-700">{e.cpfTitularCartao}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">Geralmente o CPF do responsável legal.</p>
        </label>

        <label className="text-xs font-semibold text-slate-700">
          Dia de vencimento das mensalidades <span className="text-red-500">*</span>
          <select
            name="diaVencimento"
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
          >
            <option value="">— Escolha —</option>
            <option value="10">Dia 10 do mês</option>
            <option value="15">Dia 15 do mês</option>
            <option value="20">Dia 20 do mês</option>
          </select>
          {e.diaVencimento && (
            <p className="mt-1 text-[11px] font-semibold text-rose-700">{e.diaVencimento}</p>
          )}
        </label>
      </div>

      {state?.erro && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{state.erro}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
        >
          Cadastrar cartão e ativar cobrança
        </button>
      </div>
    </form>
  );
}
