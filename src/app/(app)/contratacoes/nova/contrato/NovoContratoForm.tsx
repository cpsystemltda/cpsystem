"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ChevronLeft, MapPin, Users, FileSignature } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor, type AtaItemRef } from "@/components/ItensEditor";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { EnderecosEntregaEditor, PontosFocaisEditor } from "@/components/EditoresOrgao";
import { criarContratoAction } from "@/app/actions/contratacoes";
import { extrairContratoPdfAction } from "@/app/actions/iaExtracao";
import {
  OPCOES_PROCEDIMENTO,
  OPCOES_TIPO,
  OPCOES_MODALIDADE_ENTREGA,
  OPCOES_MARCO_INICIAL,
} from "@/lib/validators";
import { Plus, Trash2 } from "lucide-react";
import type { ContratoExtraido } from "@/lib/extrairAta";

type EmpresaOpt = { value: string; label: string };
type AtaOpt = { value: string; label: string; itens: AtaItemRef[] };

export default function NovoContratoForm({ empresas, atas }: { empresas: EmpresaOpt[]; atas: AtaOpt[] }) {
  const [state, formAction] = useActionState(criarContratoAction, null);
  const e = state?.campos ?? {};
  const [ataId, setAtaId] = useState("");
  const [vinculadoArp, setVinculadoArp] = useState<"SIM" | "NAO">(atas.length > 0 ? "NAO" : "NAO");
  const [dados, setDados] = useState<ContratoExtraido | null>(null);
  const [modalidadeEntrega, setModalidadeEntrega] = useState<"INTEGRAL" | "PARCELADA" | "SOB_DEMANDA">("INTEGRAL");
  const [marcoInicialPrazo, setMarcoInicialPrazo] = useState<string>("");

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

            {/* Toggle Vinculado a ARP */}
            <div className="col-span-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-semibold text-slate-700">
                  Este contrato é derivado de uma ARP (Ata de Registro de Preços)?
                </span>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="vinculadoArp"
                    value="SIM"
                    checked={vinculadoArp === "SIM"}
                    onChange={() => setVinculadoArp("SIM")}
                  />
                  Sim
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="vinculadoArp"
                    value="NAO"
                    checked={vinculadoArp === "NAO"}
                    onChange={() => {
                      setVinculadoArp("NAO");
                      setAtaId("");
                    }}
                  />
                  Não, é contrato direto
                </label>
              </div>
              {vinculadoArp === "SIM" && (
                <div className="mt-3">
                  <Select
                    label="Qual a ARP?"
                    name="ataId"
                    options={atas.map((a) => ({ value: a.value, label: a.label }))}
                    required={vinculadoArp === "SIM"}
                    value={ataId}
                    onChange={(ev) => setAtaId(ev.currentTarget.value)}
                  />
                  <p className="mt-1.5 text-xs text-emerald-700">
                    O sistema vai abater automaticamente o saldo dos itens da ARP escolhida.
                  </p>
                </div>
              )}
            </div>

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
              label="Nº da Ordem de Fornecimento (se houver)"
              name="numeroOrdemFornecimento"
              placeholder="OF nº/ano"
              erro={e.numeroOrdemFornecimento}
              span={2}
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

        <Secao titulo="Modalidade de entrega">
          <p className="mb-4 text-xs text-slate-600">
            Conforme Lei 14.133 (fluxograma do contrato independente). Em entrega
            parcelada, cada parcela gera nota fiscal e pagamento próprios.
          </p>
          <div className="grid grid-cols-4 gap-4">
            <Select
              label="Como será entregue?"
              name="modalidadeEntrega"
              options={OPCOES_MODALIDADE_ENTREGA}
              required
              erro={e.modalidadeEntrega}
              span={2}
              value={modalidadeEntrega}
              onChange={(ev) =>
                setModalidadeEntrega(ev.currentTarget.value as "INTEGRAL" | "PARCELADA" | "SOB_DEMANDA")
              }
            />

            {modalidadeEntrega !== "SOB_DEMANDA" && (
              <Select
                label="O prazo de entrega começa a contar de"
                name="marcoInicialPrazo"
                options={OPCOES_MARCO_INICIAL}
                required
                erro={e.marcoInicialPrazo}
                span={2}
                value={marcoInicialPrazo}
                onChange={(ev) => setMarcoInicialPrazo(ev.currentTarget.value)}
              />
            )}

            {marcoInicialPrazo === "OUTRO" && modalidadeEntrega !== "SOB_DEMANDA" && (
              <Field
                label="Descreva o documento hábil"
                name="marcoInicialDescricao"
                placeholder='Ex: "ordem de serviço", "termo de recebimento", etc.'
                required
                erro={e.marcoInicialDescricao}
                span={4}
              />
            )}
          </div>

          {modalidadeEntrega === "PARCELADA" && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Cronograma de parcelas</h3>
              <p className="mb-3 text-xs text-slate-600">
                Cada parcela é entregue em prazo distinto (contado a partir do marco inicial). A
                cada parcela cumprida, emite-se nota fiscal e o órgão paga.
              </p>
              <ParcelasEditor erro={e.parcelas} />
            </div>
          )}

          {modalidadeEntrega === "SOB_DEMANDA" && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Quantidade estimativa, sem cronograma fixo. Cada empenho/AF puxa do saldo do
              contrato — equivalente operacional a uma Ata, mas formalizado por Termo de Contrato.
            </p>
          )}
        </Secao>

        <Secao titulo="Endereços de entrega/execução">
          <p className="mb-3 text-xs text-slate-600">
            Locais onde o contrato será cumprido. Os empenhos derivados podem referenciar
            qualquer um deles.
          </p>
          <EnderecosEntregaEditor />
        </Secao>

        <Secao titulo="Pontos focais do órgão (Lei 14.133 art. 117)">
          <p className="mb-3 text-xs text-slate-600">
            Pessoas-chave para gestão e fiscalização. Adicione pelo menos o Gestor — Fiscais
            Técnico e Administrativo são recomendados.
          </p>
          <PontosFocaisEditor />
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

type ParcelaState = { numero: number; prazoDias: string; descricao: string; valorEstimado: string };

function ParcelasEditor({ erro }: { erro?: string }) {
  const [parcelas, setParcelas] = useState<ParcelaState[]>([
    { numero: 1, prazoDias: "30", descricao: "", valorEstimado: "" },
    { numero: 2, prazoDias: "60", descricao: "", valorEstimado: "" },
  ]);

  const atualizar = (idx: number, campo: keyof ParcelaState, valor: string) => {
    setParcelas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [campo]: campo === "numero" ? Number(valor) : valor } : p)),
    );
  };

  const adicionar = () => {
    setParcelas((prev) => [
      ...prev,
      { numero: prev.length + 1, prazoDias: "", descricao: "", valorEstimado: "" },
    ]);
  };

  const remover = (idx: number) => {
    if (parcelas.length <= 2) return;
    setParcelas((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, numero: i + 1 })));
  };

  return (
    <div>
      {erro && (
        <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      )}
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="py-2 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">Prazo (dias)</th>
            <th className="py-2 text-left font-medium">Descrição (opcional)</th>
            <th className="py-2 text-left font-medium">Valor estimado</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p, idx) => (
            <tr key={idx} className="border-b border-slate-100">
              <td className="py-2 pr-2">
                <input
                  type="hidden"
                  name={`parcelas[${idx}][numero]`}
                  value={p.numero}
                />
                <span className="text-sm font-medium text-slate-700">{p.numero}</span>
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  min="0"
                  name={`parcelas[${idx}][prazoDias]`}
                  value={p.prazoDias}
                  onChange={(ev) => atualizar(idx, "prazoDias", ev.currentTarget.value)}
                  className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  required
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="text"
                  name={`parcelas[${idx}][descricao]`}
                  value={p.descricao}
                  onChange={(ev) => atualizar(idx, "descricao", ev.currentTarget.value)}
                  placeholder="ex: 50 computadores DELL Inspiron"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name={`parcelas[${idx}][valorEstimado]`}
                  value={p.valorEstimado}
                  onChange={(ev) => atualizar(idx, "valorEstimado", ev.currentTarget.value)}
                  className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </td>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => remover(idx)}
                  disabled={parcelas.length <= 2}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40"
                  title="Remover parcela"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={adicionar}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar parcela
      </button>
    </div>
  );
}
