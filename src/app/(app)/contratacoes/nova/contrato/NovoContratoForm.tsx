"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor, type AtaItemRef } from "@/components/ItensEditor";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { criarContratoAction } from "@/app/actions/contratacoes";
import { extrairContratoPdfAction } from "@/app/actions/iaExtracao";
import { OPCOES_PROCEDIMENTO, OPCOES_TIPO } from "@/lib/validators";
import type { ContratoExtraido } from "@/lib/extrairAta";

type EmpresaOpt = { value: string; label: string };
type AtaOpt = { value: string; label: string; itens: AtaItemRef[] };

export default function NovoContratoForm({ empresas, atas }: { empresas: EmpresaOpt[]; atas: AtaOpt[] }) {
  const [state, formAction] = useActionState(criarContratoAction, null);
  const e = state?.campos ?? {};
  const [ataId, setAtaId] = useState("");
  const [dados, setDados] = useState<ContratoExtraido | null>(null);

  const ataSelecionada = atas.find((a) => a.value === ataId);
  const formKey = dados ? `auto-${dados.numero}` : "manual";

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link
        href="/contratacoes/nova"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        Novo Contrato administrativo
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Cadastre um Contrato direto ou derivado de uma Ata. Quando vinculado a Ata, o sistema valida o saldo dos itens.
      </p>

      <div className="mt-6">
        <UploadPdfPanel
          titulo="Preencher automaticamente a partir do PDF do Contrato"
          descricao="Anexe o PDF do contrato administrativo. A IA extrai número, processo, órgão, vigência, prazos e a lista completa de itens. Você confere e edita antes de salvar."
          action={extrairContratoPdfAction}
          onSuccess={setDados}
          badgeAposExtracao={(d) => `${d.itens.length} item(ns) preenchido(s)`}
        />
      </div>

      <form key={formKey} action={formAction} className="mt-8 space-y-8">
        <Secao titulo="Identificação">
          <div className="grid grid-cols-4 gap-4">
            <Select label="Empresa" name="empresaId" options={empresas} required erro={e.empresaId} span={2} />
            <Select label="Tipo de objeto" name="tipo" options={OPCOES_TIPO} required erro={e.tipo} span={2} />
            <Select
              label="Vincular a uma Ata? (opcional)"
              name="ataId"
              options={atas.map((a) => ({ value: a.value, label: a.label }))}
              span={2}
              value={ataId}
              onChange={(ev) => setAtaId(ev.currentTarget.value)}
            />
            <Field
              label="Número do Contrato (nº/ano)"
              name="numero"
              required
              erro={e.numero}
              span={1}
              defaultValue={dados?.numero}
            />
            <Field
              label="Nº da Nota de Empenho (suporte)"
              name="numeroNotaEmpenho"
              erro={e.numeroNotaEmpenho}
              span={1}
              defaultValue={dados?.numeroNotaEmpenho ?? ""}
            />
            <Field
              label="Processo administrativo"
              name="processoAdministrativo"
              required
              erro={e.processoAdministrativo}
              span={2}
              defaultValue={dados?.processoAdministrativo}
            />
            <Select
              label="Procedimento de seleção"
              name="procedimentoSelecao"
              options={OPCOES_PROCEDIMENTO}
              required
              erro={e.procedimentoSelecao}
              span={1}
              defaultValue={dados?.procedimentoSelecao}
            />
            <Field
              label="Nº da Licitação (opcional)"
              name="numeroLicitacao"
              erro={e.numeroLicitacao}
              span={1}
              defaultValue={dados?.numeroLicitacao ?? ""}
            />
            <Field
              label="Objeto"
              name="objeto"
              required
              erro={e.objeto}
              span={4}
              defaultValue={dados?.objeto}
            />
          </div>
        </Secao>

        <Secao titulo="Órgão contratante">
          <div className="grid grid-cols-4 gap-4">
            <Field
              label="Nome do órgão"
              name="orgaoNome"
              required
              erro={e.orgaoNome}
              span={2}
              defaultValue={dados?.orgaoNome}
            />
            <Field
              label="CNPJ do órgão"
              name="orgaoCnpj"
              placeholder="00.000.000/0000-00"
              required
              erro={e.orgaoCnpj}
              span={2}
              defaultValue={dados?.orgaoCnpj}
            />
            <Field
              label="Endereço"
              name="orgaoEndereco"
              required
              erro={e.orgaoEndereco}
              span={4}
              defaultValue={dados?.orgaoEndereco}
            />
            <Field
              label="E-mail"
              name="orgaoEmail"
              type="email"
              erro={e.orgaoEmail}
              span={2}
              defaultValue={dados?.orgaoEmail ?? ""}
            />
            <Field
              label="Telefone"
              name="orgaoTelefone"
              erro={e.orgaoTelefone}
              span={2}
              defaultValue={dados?.orgaoTelefone ?? ""}
            />
          </div>
        </Secao>

        <Secao titulo="Datas e prazos">
          <div className="grid grid-cols-4 gap-4">
            <Field
              label="Data de assinatura"
              name="dataAssinatura"
              type="date"
              required
              erro={e.dataAssinatura}
              span={1}
              defaultValue={dados?.dataAssinatura}
            />
            <Field
              label="Data de publicação"
              name="dataPublicacao"
              type="date"
              erro={e.dataPublicacao}
              span={1}
              defaultValue={dados?.dataPublicacao ?? ""}
            />
            <Field
              label="Vigência — início"
              name="vigenciaInicio"
              type="date"
              required
              erro={e.vigenciaInicio}
              span={1}
              defaultValue={dados?.vigenciaInicio}
            />
            <Field
              label="Vigência — fim"
              name="vigenciaFim"
              type="date"
              required
              erro={e.vigenciaFim}
              span={1}
              defaultValue={dados?.vigenciaFim}
            />
            <Field
              label="Prazo de entrega (dias)"
              name="prazoEntregaDias"
              type="number"
              min="0"
              erro={e.prazoEntregaDias}
              span={1}
              defaultValue={dados?.prazoEntregaDias?.toString() ?? ""}
            />
            <Field
              label="Prazo de pagamento (dias)"
              name="prazoPagamentoDias"
              type="number"
              min="0"
              erro={e.prazoPagamentoDias}
              span={1}
              defaultValue={dados?.prazoPagamentoDias?.toString() ?? ""}
            />
            <Field
              label="Marco do orçamento estimado (alerta de reajuste em +1 ano)"
              name="marcoOrcamentoEstimado"
              type="date"
              erro={e.marcoOrcamentoEstimado}
              span={2}
            />
          </div>
        </Secao>

        <Secao titulo="Itens contratados">
          {ataSelecionada && (
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Vinculando à Ata <strong>{ataSelecionada.label}</strong>. Selecione cada item da Ata na primeira coluna — o saldo será validado automaticamente.
            </p>
          )}
          <ItensEditor ataItens={ataSelecionada?.itens} itensIniciais={dados?.itens} />
        </Secao>

        {state?.erro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.erro}
          </div>
        )}

        <div className="flex gap-3">
          <SubmitButton>Cadastrar Contrato</SubmitButton>
          <Link
            href="/contratacoes/nova"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
      {children}
    </section>
  );
}
