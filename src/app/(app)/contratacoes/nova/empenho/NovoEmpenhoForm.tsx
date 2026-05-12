"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor, type AtaItemRef } from "@/components/ItensEditor";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { EnderecosEntregaEditor, PontosFocaisEditor } from "@/components/EditoresOrgao";
import type { ItemInicial } from "@/components/ItensEditor";
import { criarEmpenhoAction, editarEmpenhoAction } from "@/app/actions/contratacoes";
import { extrairEmpenhoPdfAction } from "@/app/actions/iaExtracao";
import { OPCOES_PROCEDIMENTO, OPCOES_TIPO } from "@/lib/validators";
import type { EmpenhoExtraido } from "@/lib/extrairAta";

type EmpresaOpt = { value: string; label: string };
type AtaOpt = { value: string; label: string; itens: AtaItemRef[] };
type ContratoOpt = { value: string; label: string; ataId: string | null };

export type EmpenhoValoresIniciais = {
  empresaId: string;
  ataId: string | null;
  contratoId: string | null;
  tipo: string;
  numero: string;
  numeroOrdemFornecimento: string | null;
  processoAdministrativo: string;
  procedimentoSelecao: string;
  numeroLicitacao: string | null;
  objeto: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string;
  orgaoEmail: string | null;
  orgaoTelefone: string | null;
  dataEmissao: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  itens: ItemInicial[];
  enderecosEntrega: { id: string; rotulo: string | null; endereco: string }[];
  pontosFocais: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    funcao: string;
    funcaoDescricao: string | null;
  }[];
};

export default function NovoEmpenhoForm({
  empresas,
  atas,
  contratos,
  modo = "criar",
  empenhoId,
  valoresIniciais,
}: {
  empresas: EmpresaOpt[];
  atas: AtaOpt[];
  contratos: ContratoOpt[];
  modo?: "criar" | "editar";
  empenhoId?: string;
  valoresIniciais?: EmpenhoValoresIniciais;
}) {
  const action = modo === "editar" ? editarEmpenhoAction : criarEmpenhoAction;
  const [state, formAction] = useActionState(action, null);
  const e = state?.campos ?? {};
  const vi = valoresIniciais;
  const origemInicial: "livre" | "ata" | "contrato" = vi?.contratoId
    ? "contrato"
    : vi?.ataId
      ? "ata"
      : "livre";
  const [origem, setOrigem] = useState<"livre" | "ata" | "contrato">(origemInicial);
  const [ataId, setAtaId] = useState(vi?.ataId ?? "");
  const [contratoId, setContratoId] = useState(vi?.contratoId ?? "");
  const [dados, setDados] = useState<EmpenhoExtraido | null>(null);

  const ataSelecionada = origem === "ata" ? atas.find((a) => a.value === ataId) : undefined;
  const formKey = dados ? `auto-${dados.numero}` : "manual";

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <Link
        href="/contratacoes/nova"
        className="inline-flex items-center gap-1 text-sm transition"
        style={{ color: "var(--text-mute)" }}
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      <header className="glass mt-4 rounded-[28px] px-9 py-7">
        <div className="relative z-[1]">
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary)" }}
          >
            {modo === "editar" ? "Editar registro · Nota de Empenho" : "Nova contratação · Nota de Empenho"}
          </p>
          <h1
            className="mt-2 text-[40px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
          >
            {modo === "editar" ? "Corrigir " : "Nova "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {modo === "editar" ? `Empenho ${vi?.numero ?? ""}` : "Nota de Empenho"}
            </em>
          </h1>
          <p
            className="mt-3 max-w-[640px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            {modo === "editar"
              ? "Ajuste qualquer campo. Alterações em valores monetários, vigências e CNPJs pedem confirmação. Tudo fica registrado no histórico. Não é possível editar empenhos já pagos."
              : "Reserva orçamentária. Pode ser autônoma, derivada de Ata (SRP) ou de Contrato existente. Lei 14.133/2021 art. 95 — substitui o Termo de Contrato em hipóteses específicas."}
          </p>
        </div>
      </header>

      {modo !== "editar" && (
        <div className="mt-6">
          <UploadPdfPanel
            titulo="Preencher automaticamente a partir do PDF da Nota de Empenho"
            descricao="Anexe o PDF da NE. A IA extrai número, identificador, processo, órgão, vigência, prazos e os itens empenhados. Você confere e edita antes de salvar."
            action={extrairEmpenhoPdfAction}
            onSuccess={setDados}
            badgeAposExtracao={(d) => `${d.itens.length} item(ns) preenchido(s)`}
          />
        </div>
      )}

      <form
        key={formKey}
        action={formAction}
        className="mt-8 space-y-8"
        onSubmit={(ev) => {
          if (modo === "editar") {
            const ok = window.confirm(
              "Tem certeza? As alterações em valores monetários, datas de vigência e CNPJs serão registradas no histórico.",
            );
            if (!ok) {
              ev.preventDefault();
              ev.stopPropagation();
            }
          }
        }}
      >
        {modo === "editar" && empenhoId && (
          <input type="hidden" name="empenhoId" value={empenhoId} />
        )}
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
            <Select label="Empresa" name="empresaId" options={empresas} required erro={e.empresaId} span={2} defaultValue={vi?.empresaId} />
            <Select label="Tipo de objeto" name="tipo" options={OPCOES_TIPO} required erro={e.tipo} span={2} defaultValue={vi?.tipo} />
            <Field
              label="Número do Empenho (nº/ano)"
              name="numero"
              required
              erro={e.numero}
              span={1}
              defaultValue={dados?.numero ?? vi?.numero}
            />
            <Field
              label="Processo administrativo"
              name="processoAdministrativo"
              required
              erro={e.processoAdministrativo}
              span={2}
              defaultValue={dados?.processoAdministrativo ?? vi?.processoAdministrativo}
            />
            <Select
              label="Procedimento de seleção"
              name="procedimentoSelecao"
              options={OPCOES_PROCEDIMENTO}
              required
              erro={e.procedimentoSelecao}
              span={1}
              defaultValue={dados?.procedimentoSelecao ?? vi?.procedimentoSelecao}
            />
            <Field
              label="Nº da Licitação (opcional)"
              name="numeroLicitacao"
              erro={e.numeroLicitacao}
              span={2}
              defaultValue={dados?.numeroLicitacao ?? vi?.numeroLicitacao ?? ""}
            />
            <Field
              label="Objeto"
              name="objeto"
              required
              erro={e.objeto}
              span={4}
              defaultValue={dados?.objeto ?? vi?.objeto}
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
              defaultValue={dados?.orgaoNome ?? vi?.orgaoNome}
            />
            <Field
              label="CNPJ do órgão"
              name="orgaoCnpj"
              placeholder="00.000.000/0000-00"
              required
              erro={e.orgaoCnpj}
              span={2}
              defaultValue={dados?.orgaoCnpj ?? vi?.orgaoCnpj}
            />
            <Field
              label="Endereço"
              name="orgaoEndereco"
              required
              erro={e.orgaoEndereco}
              span={4}
              defaultValue={dados?.orgaoEndereco ?? vi?.orgaoEndereco}
            />
            <Field
              label="E-mail"
              name="orgaoEmail"
              type="email"
              erro={e.orgaoEmail}
              span={2}
              defaultValue={dados?.orgaoEmail ?? vi?.orgaoEmail ?? ""}
            />
            <Field
              label="Telefone"
              name="orgaoTelefone"
              erro={e.orgaoTelefone}
              span={2}
              defaultValue={dados?.orgaoTelefone ?? vi?.orgaoTelefone ?? ""}
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
              defaultValue={dados?.dataEmissao ?? vi?.dataEmissao}
            />
            <Field
              label="Vigência — início"
              name="vigenciaInicio"
              type="date"
              required
              erro={e.vigenciaInicio}
              span={1}
              defaultValue={dados?.vigenciaInicio ?? vi?.vigenciaInicio}
            />
            <Field
              label="Vigência — fim"
              name="vigenciaFim"
              type="date"
              required
              erro={e.vigenciaFim}
              span={1}
              defaultValue={dados?.vigenciaFim ?? vi?.vigenciaFim}
            />
            <Field
              label="Prazo de entrega (dias)"
              name="prazoEntregaDias"
              type="number"
              min="0"
              erro={e.prazoEntregaDias}
              span={1}
              defaultValue={dados?.prazoEntregaDias?.toString() ?? vi?.prazoEntregaDias?.toString() ?? ""}
            />
            <Field
              label="Prazo de pagamento (dias)"
              name="prazoPagamentoDias"
              type="number"
              min="0"
              erro={e.prazoPagamentoDias}
              span={1}
              defaultValue={dados?.prazoPagamentoDias?.toString() ?? vi?.prazoPagamentoDias?.toString() ?? ""}
            />
            <Field
              label="Nº da Ordem de Fornecimento (se houver)"
              name="numeroOrdemFornecimento"
              placeholder="OF nº/ano"
              span={2}
              defaultValue={vi?.numeroOrdemFornecimento ?? ""}
            />
          </div>
        </Secao>

        <Secao titulo="Endereços de entrega/execução">
          <p className="mb-3 text-xs text-slate-600">
            Locais onde este empenho será cumprido.
          </p>
          <EnderecosEntregaEditor iniciais={vi?.enderecosEntrega} />
        </Secao>

        <Secao titulo="Pontos focais do órgão (Lei 14.133 art. 117)">
          <p className="mb-3 text-xs text-slate-600">
            Gestor + Fiscais Técnico/Administrativo do contrato.
          </p>
          <PontosFocaisEditor iniciais={vi?.pontosFocais} />
        </Secao>

        <Secao titulo="Itens empenhados">
          {ataSelecionada && (
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Selecione cada item da Ata na primeira coluna — o saldo será validado.
            </p>
          )}
          <ItensEditor ataItens={ataSelecionada?.itens} itensIniciais={vi?.itens ?? dados?.itens} permitirLotes={false} />
        </Secao>

        {state?.erro && (
          <div
            className="rounded-2xl px-5 py-4 text-sm"
            style={{
              background: "rgba(232,138,152,0.10)",
              border: "0.5px solid rgba(232,138,152,0.3)",
              color: "var(--coral)",
            }}
          >
            <strong>Erro ao cadastrar Empenho:</strong> {state.erro}
          </div>
        )}

        <div className="flex gap-3">
          <SubmitButton>{modo === "editar" ? "Salvar alterações" : "Cadastrar Empenho"}</SubmitButton>
          <Link
            href={modo === "editar" && empenhoId ? `/execucao/${empenhoId}` : "/contratacoes/nova"}
            className="btn-secondary inline-flex"
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
    <section className="glass overflow-hidden rounded-[24px]">
      <header
        className="relative z-[1] px-8 py-5"
        style={{ borderBottom: "0.5px solid var(--hairline)" }}
      >
        <div
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.24em", color: "var(--primary)" }}
        >
          Bloco
        </div>
        <h2
          className="mt-1 text-[20px] font-extrabold"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          {titulo}
        </h2>
      </header>
      <div className="relative z-[1] px-8 py-6">{children}</div>
    </section>
  );
}
