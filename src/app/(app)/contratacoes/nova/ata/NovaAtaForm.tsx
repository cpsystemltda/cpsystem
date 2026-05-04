"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ChevronLeft, Sparkles, Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor } from "@/components/ItensEditor";
import { criarAtaAction } from "@/app/actions/contratacoes";
import { extrairAtaPdfAction } from "@/app/actions/iaExtracao";
import { OPCOES_PROCEDIMENTO, OPCOES_TIPO } from "@/lib/validators";
import type { AtaExtraida } from "@/lib/extrairAta";

type EmpresaOpt = { value: string; label: string };

export default function NovaAtaForm({ empresas }: { empresas: EmpresaOpt[] }) {
  const [state, formAction] = useActionState(criarAtaAction, null);
  const e = state?.campos ?? {};
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [extracaoErro, setExtracaoErro] = useState<string | null>(null);
  const [dados, setDados] = useState<AtaExtraida | null>(null);
  const [pdfNome, setPdfNome] = useState<string | null>(null);

  async function handleArquivo(file: File) {
    setExtraindo(true);
    setExtracaoErro(null);
    setPdfNome(file.name);

    const fd = new FormData();
    fd.append("pdf", file);
    const res = await extrairAtaPdfAction(fd);
    setExtraindo(false);

    if (!res.ok) {
      setExtracaoErro(res.erro);
      return;
    }
    setDados(res.dados);
  }

  // key força re-render do form quando dados extraídos mudam (preenche defaultValue)
  const formKey = dados ? `auto-${pdfNome}` : "manual";

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link
        href="/contratacoes/nova"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        Nova Ata de Registro de Preços
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Cadastre os dados da Ata e os itens que registram preço. O saldo é abatido conforme você gera Contratos e Empenhos.
      </p>

      {/* Bloco de upload + extração automática */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-900">
              Preencher automaticamente a partir do PDF da Ata
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Anexe o PDF original da Ata. A IA extrai número, processo, órgão, vigência, prazos e a lista completa de itens. Você confere e edita antes de salvar.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                if (f) handleArquivo(f);
              }}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={extraindo}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extraindo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extraindo dados…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {pdfNome ? "Anexar outro PDF" : "Anexar PDF da Ata"}
                  </>
                )}
              </button>
              {pdfNome && !extraindo && (
                <span className="text-xs text-slate-500 truncate max-w-md">{pdfNome}</span>
              )}
              {dados && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  <Check className="h-3 w-3" /> {dados.itens.length} item(ns) preenchido(s)
                </span>
              )}
            </div>

            {extracaoErro && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{extracaoErro}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <form key={formKey} action={formAction} className="mt-8 space-y-8">
        <Secao titulo="Identificação">
          <div className="grid grid-cols-4 gap-4">
            <Select label="Empresa" name="empresaId" options={empresas} required erro={e.empresaId} span={2} />
            <Select
              label="Tipo de objeto"
              name="tipo"
              options={OPCOES_TIPO}
              required
              erro={e.tipo}
              span={2}
            />
            <Field
              label="Número da Ata (nº/ano)"
              name="numero"
              placeholder="42/2026"
              required
              erro={e.numero}
              span={1}
              defaultValue={dados?.numero}
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
              span={2}
              defaultValue={dados?.numeroLicitacao ?? ""}
            />
            <Field
              label="ID Ata no PNCP (opcional)"
              name="idAtaPncp"
              erro={e.idAtaPncp}
              span={2}
              defaultValue={dados?.idAtaPncp ?? ""}
            />
            <Field
              label="Objeto (descrição geral)"
              name="objeto"
              required
              erro={e.objeto}
              span={4}
              defaultValue={dados?.objeto}
            />
          </div>
        </Secao>

        <Secao titulo="Órgão gerenciador">
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
              label="Marco do orçamento estimado (gera alerta de reajuste em +1 ano)"
              name="marcoOrcamentoEstimado"
              type="date"
              erro={e.marcoOrcamentoEstimado}
              span={2}
            />
            <label className="col-span-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="aceitaCarona"
                className="rounded border-slate-300"
                defaultChecked={dados?.aceitaCarona}
              />
              <span>Esta Ata aceita adesão (carona) por outros órgãos</span>
            </label>
          </div>
        </Secao>

        <Secao titulo="Itens registrados">
          <ItensEditor itensIniciais={dados?.itens} />
        </Secao>

        {state?.erro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.erro}
          </div>
        )}

        <div className="flex gap-3">
          <SubmitButton>Cadastrar Ata</SubmitButton>
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
