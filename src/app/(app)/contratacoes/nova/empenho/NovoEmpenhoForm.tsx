"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor, type AtaItemRef } from "@/components/ItensEditor";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { EnderecosEntregaEditor, PontosFocaisEditor } from "@/components/EditoresOrgao";
import { criarEmpenhoAction } from "@/app/actions/contratacoes";
import { extrairEmpenhoPdfAction } from "@/app/actions/iaExtracao";
import { OPCOES_PROCEDIMENTO, OPCOES_TIPO } from "@/lib/validators";
import type { EmpenhoExtraido } from "@/lib/extrairAta";

type EmpresaOpt = { value: string; label: string };
type AtaOpt = { value: string; label: string; itens: AtaItemRef[] };
type ContratoOpt = { value: string; label: string; ataId: string | null };

export default function NovoEmpenhoForm({
  empresas,
  atas,
  contratos,
}: {
  empresas: EmpresaOpt[];
  atas: AtaOpt[];
  contratos: ContratoOpt[];
}) {
  const [state, formAction] = useActionState(criarEmpenhoAction, null);
  const e = state?.campos ?? {};
  const [origem, setOrigem] = useState<"livre" | "ata" | "contrato">("livre");
  const [ataId, setAtaId] = useState("");
  const [contratoId, setContratoId] = useState("");
  const [dados, setDados] = useState<EmpenhoExtraido | null>(null);

  const ataSelecionada = origem === "ata" ? atas.find((a) => a.value === ataId) : undefined;
  const formKey = dados ? `auto-${dados.numero}` : "manual";

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <Link href="/contratacoes/nova" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Nova Nota de Empenho</h1>
      <p className="mt-1 text-sm text-slate-600">
        O Empenho representa a reserva orçamentária. Pode ser livre, derivado de uma Ata (SRP) ou de um Contrato.
      </p>

      <div className="mt-6">
        <UploadPdfPanel
          titulo="Preencher automaticamente a partir do PDF da Nota de Empenho"
          descricao="Anexe o PDF da NE. A IA extrai número, identificador, processo, órgão, vigência, prazos e os itens empenhados. Você confere e edita antes de salvar."
          action={extrairEmpenhoPdfAction}
          onSuccess={setDados}
          badgeAposExtracao={(d) => `${d.itens.length} item(ns) preenchido(s)`}
        />
      </div>

      <form key={formKey} action={formAction} className="mt-8 space-y-8">
        <Secao titulo="Origem">
          <div className="flex gap-3">
            {(["livre", "ata", "contrato"] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => {
                  setOrigem(op);
                  setAtaId("");
                  setContratoId("");
                }}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                  origem === op
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {op === "livre" ? "Empenho livre" : op === "ata" ? "Derivado de uma ARP (Ata de Registro de Preços)" : "Derivado de um Contrato"}
              </button>
            ))}
          </div>
          {origem === "ata" && (
            <Select
              label="Ata vinculada"
              name="ataId"
              options={atas.map((a) => ({ value: a.value, label: a.label }))}
              required
              value={ataId}
              onChange={(ev) => setAtaId(ev.currentTarget.value)}
              span={4}
              className="mt-4"
            />
          )}
          {origem === "contrato" && (
            <Select
              label="Contrato vinculado"
              name="contratoId"
              options={contratos.map((c) => ({ value: c.value, label: c.label }))}
              required
              value={contratoId}
              onChange={(ev) => setContratoId(ev.currentTarget.value)}
              span={4}
              className="mt-4"
            />
          )}
        </Secao>

        <Secao titulo="Identificação">
          <div className="grid grid-cols-4 gap-4">
            <Select label="Empresa" name="empresaId" options={empresas} required erro={e.empresaId} span={2} />
            <Select label="Tipo de objeto" name="tipo" options={OPCOES_TIPO} required erro={e.tipo} span={2} />
            <Field
              label="Número do Empenho (nº/ano)"
              name="numero"
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
              label="Data de emissão da NE"
              name="dataEmissao"
              type="date"
              required
              erro={e.dataEmissao}
              span={1}
              defaultValue={dados?.dataEmissao}
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
              label="Nº da Ordem de Fornecimento (se houver)"
              name="numeroOrdemFornecimento"
              placeholder="OF nº/ano"
              span={2}
            />
          </div>
        </Secao>

        <Secao titulo="Endereços de entrega/execução">
          <p className="mb-3 text-xs text-slate-600">
            Locais onde este empenho será cumprido.
          </p>
          <EnderecosEntregaEditor />
        </Secao>

        <Secao titulo="Pontos focais do órgão (Lei 14.133 art. 117)">
          <p className="mb-3 text-xs text-slate-600">
            Gestor + Fiscais Técnico/Administrativo do contrato.
          </p>
          <PontosFocaisEditor />
        </Secao>

        <Secao titulo="Itens empenhados">
          {ataSelecionada && (
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Selecione cada item da Ata na primeira coluna — o saldo será validado.
            </p>
          )}
          <ItensEditor ataItens={ataSelecionada?.itens} itensIniciais={dados?.itens} />
        </Secao>

        {state?.erro && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.erro}</div>
        )}

        <div className="flex gap-3">
          <SubmitButton>Cadastrar Empenho</SubmitButton>
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
