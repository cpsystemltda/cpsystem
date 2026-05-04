"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ChevronLeft } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { criarEmpresaAction } from "@/app/actions/empresas";

const PORTES = [
  { value: "MEI", label: "MEI" },
  { value: "ME", label: "Microempresa (ME)" },
  { value: "EPP", label: "Empresa de Pequeno Porte (EPP)" },
  { value: "MEDIA", label: "Média" },
  { value: "GRANDE", label: "Grande" },
];

export default function NovaEmpresaPage() {
  const [state, formAction] = useActionState(criarEmpresaAction, null);
  const e = state?.campos ?? {};

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <Link href="/empresas" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar para Empresas
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-slate-900">Adicionar CNPJ</h1>
      <p className="mt-1 text-sm text-slate-600">Inclua mais uma empresa do seu grupo econômico.</p>

      <form action={formAction} className="mt-8 grid grid-cols-4 gap-4">
        <Field label="Razão social" name="razaoSocial" required erro={e.razaoSocial} span={3} />
        <Select label="Porte" name="porte" options={PORTES} required erro={e.porte} span={1} />
        <Field label="Nome fantasia" name="nomeFantasia" erro={e.nomeFantasia} span={2} />
        <Field label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" required erro={e.cnpj} span={2} />
        <Field label="CNAE principal" name="cnaePrincipal" required erro={e.cnaePrincipal} span={2} />
        <Field label="CNAEs secundários (separar por vírgula)" name="cnaesSecundarios" erro={e.cnaesSecundarios} span={2} />
        <Field label="Natureza jurídica" name="naturezaJuridica" required erro={e.naturezaJuridica} span={2} />
        <Field label="Endereço" name="endereco" required erro={e.endereco} span={2} />
        <Field label="CEP" name="cep" placeholder="00000-000" required erro={e.cep} span={1} />
        <Field label="E-mail" name="email" type="email" required erro={e.email} span={3} />
        <Field label="Telefone(s)" name="telefones" placeholder="(61) 9 9999-9999" required erro={e.telefones} span={2} />
        <Field label="Responsável" name="responsavel" required erro={e.responsavel} span={2} />

        {state?.erro && (
          <div className="col-span-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.erro}
          </div>
        )}

        <div className="col-span-4 mt-2 flex gap-3">
          <SubmitButton>Cadastrar empresa</SubmitButton>
          <Link
            href="/empresas"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
