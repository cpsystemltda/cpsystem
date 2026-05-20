"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ChevronLeft, MapPin, Users, FileSignature } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { TooltipAjuda } from "@/components/TooltipAjuda";
import { AJUDA } from "@/lib/textosAjuda";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor, type AtaItemRef } from "@/components/ItensEditor";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { EnderecosEntregaEditor, PontosFocaisEditor } from "@/components/EditoresOrgao";
import type { ItemInicial } from "@/components/ItensEditor";
import { criarContratoAction, editarContratoAction } from "@/app/actions/contratacoes";
import { extrairContratoPdfAction } from "@/app/actions/iaExtracao";
import { matchItensIaAction, type Sugestao as SugestaoIa } from "@/app/actions/iaMatchItens";
import { usePrefillIa } from "@/lib/usePrefillIa";
import {
  OPCOES_PROCEDIMENTO,
  OPCOES_TIPO,
  OPCOES_MODALIDADE_ENTREGA,
  OPCOES_MARCO_INICIAL,
} from "@/lib/validators";
import { Plus, Trash2 } from "lucide-react";
import type { ContratoExtraido } from "@/lib/extrairAta";
import {
  TextareaGlass,
  CnpjInput,
} from "@/components/forms/glass";
import {
  calcularVigenciaFim,
  detectarPrazoVigencia,
} from "@/components/forms/vigencia";

type EmpresaOpt = { value: string; label: string };
type AtaOpt = { value: string; label: string; itens: AtaItemRef[] };

export type ContratoValoresIniciais = {
  empresaId: string;
  ataId: string | null;
  tipo: string;
  numero: string;
  numeroNotaEmpenho: string | null;
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
  dataAssinatura: string;
  dataPublicacao: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoEntregaUnidade?: "DIAS" | "MESES";
  prazoEntregaModo?: "RELATIVO" | "DATA_CERTA" | "SOB_DEMANDA";
  dataEntregaCerta?: string | null;
  prazoPagamentoDias: number | null;
  marcoReajusteOrigem?: string | null;
  marcoOrcamentoEstimado: string | null;
  modalidadeEntrega: "INTEGRAL" | "PARCELADA" | "SOB_DEMANDA";
  marcoInicialPrazo: string | null;
  marcoInicialDescricao: string | null;
  itens: ItemInicial[];
  parcelas: {
    id: string;
    numero: number;
    prazoDias: number;
    descricao: string | null;
    valorEstimado: number | null;
  }[];
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

export default function NovoContratoForm({
  empresas,
  atas,
  modo = "criar",
  contratoId,
  valoresIniciais,
}: {
  empresas: EmpresaOpt[];
  atas: AtaOpt[];
  modo?: "criar" | "editar";
  contratoId?: string;
  valoresIniciais?: ContratoValoresIniciais;
}) {
  const action = modo === "editar" ? editarContratoAction : criarContratoAction;
  const [state, formAction] = useActionState(action, null);
  const e = state?.campos ?? {};
  const vi = valoresIniciais;
  const [ataId, setAtaId] = useState(vi?.ataId ?? "");
  const [vinculadoArp, setVinculadoArp] = useState<"SIM" | "NAO">(vi?.ataId ? "SIM" : "NAO");
  const [dados, setDados] = useState<ContratoExtraido | null>(null);
  const [modalidadeEntrega, setModalidadeEntrega] = useState<"INTEGRAL" | "PARCELADA" | "SOB_DEMANDA">(
    vi?.modalidadeEntrega ?? "INTEGRAL",
  );
  const [marcoInicialPrazo, setMarcoInicialPrazo] = useState<string>(vi?.marcoInicialPrazo ?? "");

  // Ajuste 3 — Bloco de Vigência (Início + Prazo + Fim calculado)
  const [vigenciaInicio, setVigenciaInicio] = useState<string>(vi?.vigenciaInicio ?? "");
  const prazoDetectado = detectarPrazoVigencia(vi?.vigenciaInicio ?? "", vi?.vigenciaFim ?? "");
  const [prazoVigQtd, setPrazoVigQtd] = useState<number>(prazoDetectado?.qtd ?? 1);
  const [prazoVigUnidade, setPrazoVigUnidade] = useState<"DIAS" | "MESES" | "ANOS">(
    prazoDetectado?.unidade ?? "ANOS",
  );
  const vigenciaFim = calcularVigenciaFim(vigenciaInicio, prazoVigQtd, prazoVigUnidade);

  // Ajuste 4 — Prazo de entrega com 2 modos (relativo OU data certa)
  const [prazoEntregaModo, setPrazoEntregaModo] = useState<"RELATIVO" | "DATA_CERTA" | "SOB_DEMANDA">(
    vi?.prazoEntregaModo ?? "RELATIVO",
  );
  const [prazoEntregaUnidade, setPrazoEntregaUnidade] = useState<"DIAS" | "MESES">(
    vi?.prazoEntregaUnidade ?? "DIAS",
  );

  // Ajuste 5 — Marco de reajuste (Origem + data inicial auto-preenchida)
  const [marcoReajusteOrigem, setMarcoReajusteOrigem] = useState<string>(
    vi?.marcoReajusteOrigem ?? "",
  );
  const [dataAssinaturaState, setDataAssinaturaState] = useState<string>(vi?.dataAssinatura ?? "");
  const [marcoOrcamentoEstimado, setMarcoOrcamentoEstimado] = useState<string>(
    vi?.marcoOrcamentoEstimado ?? "",
  );
  // Quando marco = ASSINATURA, a data inicial é a data de assinatura.
  // Quando = ORCAMENTO_ESTIMADO, usuário preenche. Quando = OMISSA, desabilitado.
  const dataInicialMarcoCalculada =
    marcoReajusteOrigem === "ASSINATURA"
      ? dataAssinaturaState
      : marcoReajusteOrigem === "ORCAMENTO_ESTIMADO"
        ? marcoOrcamentoEstimado
        : "";

  // Ajuste 6 — PDF persistido + badge AUTO
  const [arquivoPdfUrl, setArquivoPdfUrl] = useState<string | null>(null);
  const [arquivoPdfNome, setArquivoPdfNome] = useState<string | null>(null);
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());

  // M9 IA — sugestões de matching de itens contra a Ata vinculada
  const [sugestoesItens, setSugestoesItens] = useState<SugestaoIa[]>([]);

  // M9 IA — prefill via UploadInteligenteCard (?prefill=key)
  const prefill = usePrefillIa<ContratoExtraido>("CONTRATO");
  useEffect(() => {
    if (!prefill) return;
    if (prefill.dados) setDados(prefill.dados);
    if (prefill.arquivoUrl) setArquivoPdfUrl(prefill.arquivoUrl);
    if (prefill.arquivoNome) setArquivoPdfNome(prefill.arquivoNome);
  }, [prefill]);

  // Quando IA preenche, atualiza states locais (vigência, dataAssinatura) e
  // marca campos preenchidos como AUTO.
  useEffect(() => {
    if (!dados) return;
    if (dados.vigenciaInicio) setVigenciaInicio(dados.vigenciaInicio);
    if (dados.dataAssinatura) setDataAssinaturaState(dados.dataAssinatura);
    if (dados.vigenciaInicio && dados.vigenciaFim) {
      const det = detectarPrazoVigencia(dados.vigenciaInicio, dados.vigenciaFim);
      if (det) {
        setPrazoVigQtd(det.qtd);
        setPrazoVigUnidade(det.unidade);
      }
    }
    const auto = new Set<string>();
    const d = dados as unknown as Record<string, unknown>;
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) auto.add(k);
    }
    setCamposAuto(auto);
  }, [dados]);

  const ataSelecionada = atas.find((a) => a.value === ataId);
  const formKey = dados ? `auto-${dados.numero}` : "manual";

  // M9 IA — quando IA extraiu itens E há ata vinculada, dispara matching.
  useEffect(() => {
    if (!dados || !dados.itens || dados.itens.length === 0) return;
    if (!ataSelecionada || !ataSelecionada.itens.length) {
      setSugestoesItens([]);
      return;
    }
    let cancelled = false;
    matchItensIaAction(dados.itens, ataSelecionada.itens).then((res) => {
      if (cancelled) return;
      if (res.ok) setSugestoesItens(res.sugestoes);
    });
    return () => {
      cancelled = true;
    };
  }, [dados, ataSelecionada]);

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
            {modo === "editar" ? "Editar registro · Contrato administrativo" : "Nova contratação · Contrato administrativo"}
          </p>
          <h1
            className="mt-2 text-[40px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
          >
            {modo === "editar" ? "Corrigir " : "Novo "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {modo === "editar" ? `Contrato ${vi?.numero ?? ""}` : "Contrato"}
            </em>
          </h1>
          <p
            className="mt-3 max-w-[640px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            {modo === "editar"
              ? "Ajuste qualquer campo. Alterações em valores monetários, vigências e CNPJs pedem confirmação. Tudo fica registrado no histórico."
              : "Direto ou derivado de uma Ata. Quando vinculado a Ata, o sistema valida o saldo dos itens automaticamente."}
          </p>
        </div>
      </header>

      {modo !== "editar" && (
        <div className="mt-6">
          <UploadPdfPanel
            titulo="Preencher automaticamente a partir do PDF do Contrato"
            descricao="Anexe o PDF do contrato administrativo. A IA extrai número, processo, órgão, vigência, prazos e a lista completa de itens. Você confere e edita antes de salvar."
            action={extrairContratoPdfAction}
            onSuccess={setDados}
            onArquivoSalvo={(info) => {
              setArquivoPdfUrl(info.url);
              setArquivoPdfNome(info.nome);
            }}
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
        {modo === "editar" && contratoId && (
          <input type="hidden" name="contratoId" value={contratoId} />
        )}
        {/* PDF persistido pela IA — vira Anexo do Contrato após save */}
        {arquivoPdfUrl && (
          <>
            <input type="hidden" name="arquivoPdfUrl" value={arquivoPdfUrl} />
            <input type="hidden" name="arquivoPdfNome" value={arquivoPdfNome ?? ""} />
          </>
        )}
        {/* Hidden inputs dos campos controlados que viram payload do server */}
        <input type="hidden" name="vigenciaInicio" value={vigenciaInicio} />
        <input type="hidden" name="vigenciaFim" value={vigenciaFim} />
        <input type="hidden" name="prazoEntregaModo" value={prazoEntregaModo} />
        <input type="hidden" name="prazoEntregaUnidade" value={prazoEntregaUnidade} />
        <input type="hidden" name="marcoReajusteOrigem" value={marcoReajusteOrigem} />
        {/* Quando marco = ASSINATURA, a data inicial é a dataAssinatura;
            quando = ORCAMENTO_ESTIMADO, é o marcoOrcamentoEstimado */}
        <input
          type="hidden"
          name="marcoOrcamentoEstimado"
          value={dataInicialMarcoCalculada}
        />
        <Secao titulo="Identificação">
          <div className="grid grid-cols-4 gap-4">
            <Select label="Empresa" name="empresaId" options={empresas} required erro={e.empresaId} span={2} defaultValue={vi?.empresaId} />
            <Select label="Tipo de objeto" name="tipo" options={OPCOES_TIPO} required erro={e.tipo} span={2} defaultValue={vi?.tipo} ajuda={AJUDA.tipoContrato} />

            {/* Toggle Vinculado a ARP */}
            <div className="col-span-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <span>Este contrato é derivado de uma ARP (Ata de Registro de Preços)?</span>
                  <TooltipAjuda texto={AJUDA.origemContrato} />
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
              defaultValue={dados?.numero ?? vi?.numero}
            />
            <Field
              label="Nº da Nota de Empenho (suporte)"
              name="numeroNotaEmpenho"
              erro={e.numeroNotaEmpenho}
              span={1}
              defaultValue={dados?.numeroNotaEmpenho ?? vi?.numeroNotaEmpenho ?? ""}
            />
            <Field
              label="Nº da Ordem de Fornecimento (se houver)"
              name="numeroOrdemFornecimento"
              placeholder="OF nº/ano"
              erro={e.numeroOrdemFornecimento}
              span={2}
              defaultValue={vi?.numeroOrdemFornecimento ?? ""}
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
              span={1}
              defaultValue={dados?.numeroLicitacao ?? vi?.numeroLicitacao ?? ""}
            />
            <TextareaGlass
              label="Objeto"
              name="objeto"
              required
              erro={e.objeto}
              span={4}
              minRows={3}
              defaultValue={dados?.objeto ?? vi?.objeto}
              auto={camposAuto.has("objeto")}
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
            <CnpjInput
              label="CNPJ do órgão"
              name="orgaoCnpj"
              required
              erro={e.orgaoCnpj}
              span={2}
              defaultValue={dados?.orgaoCnpj ?? vi?.orgaoCnpj}
              auto={camposAuto.has("orgaoCnpj")}
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
            {/* Data de assinatura — auto-preenche o marco de reajuste quando
                origem = ASSINATURA */}
            <Field
              label="Data de assinatura"
              name="dataAssinatura"
              type="date"
              required
              erro={e.dataAssinatura}
              span={1}
              value={dataAssinaturaState || dados?.dataAssinatura || vi?.dataAssinatura || ""}
              onChange={(ev) => setDataAssinaturaState(ev.currentTarget.value)}
            />
            <Field
              label="Data de publicação"
              name="dataPublicacao"
              type="date"
              erro={e.dataPublicacao}
              span={1}
              defaultValue={dados?.dataPublicacao ?? vi?.dataPublicacao ?? ""}
            />
            <Field
              label="Vigência — início"
              name="__vigenciaInicio_display"
              type="date"
              required
              erro={e.vigenciaInicio}
              span={1}
              value={vigenciaInicio}
              onChange={(ev) => setVigenciaInicio(ev.currentTarget.value)}
            />
            {/* Prazo de vigência — qtd + unidade. Calcula vigenciaFim auto. */}
            <div className="col-span-1">
              <span
                className="mb-1.5 block text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                Vigência — prazo
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={prazoVigQtd}
                  onChange={(ev) => setPrazoVigQtd(Number(ev.target.value) || 0)}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                />
                <select
                  value={prazoVigUnidade}
                  onChange={(ev) =>
                    setPrazoVigUnidade(ev.target.value as "DIAS" | "MESES" | "ANOS")
                  }
                  className="rounded-xl px-3 py-3 text-sm font-bold uppercase"
                  style={{
                    border: "0.5px solid var(--hairline)",
                    background: "rgba(255,255,255,0.7)",
                    color: "var(--text)",
                    letterSpacing: "0.06em",
                  }}
                >
                  <option value="DIAS">Dias</option>
                  <option value="MESES">Meses</option>
                  <option value="ANOS">Anos</option>
                </select>
              </div>
              <span className="mt-1 block text-[11px]" style={{ color: "var(--text-mute)" }}>
                Sugestão: 1 Ano (ajustável).
              </span>
            </div>
            {/* Vigência fim — readonly, derivada do cálculo */}
            <div className="col-span-2">
              <span
                className="mb-1.5 block text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                Vigência — fim (calculado)
              </span>
              <input
                type="text"
                readOnly
                value={
                  vigenciaFim
                    ? new Date(vigenciaFim + "T12:00:00").toLocaleDateString("pt-BR")
                    : "—"
                }
                className="w-full rounded-xl px-4 py-3 text-sm font-bold tabular"
                style={{
                  border: "0.5px solid var(--hairline)",
                  background: "rgba(15,14,12,0.04)",
                  color: vigenciaFim ? "var(--text)" : "var(--text-mute)",
                }}
              />
              {e.vigenciaFim && (
                <span className="mt-1 block text-[11px]" style={{ color: "var(--coral-deep)" }}>
                  {e.vigenciaFim}
                </span>
              )}
            </div>

            {/* Prazo de entrega/execução — 2 modos: RELATIVO ou DATA_CERTA */}
            <div className="col-span-2">
              <span
                className="mb-1.5 block text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                Prazo de entrega/execução
              </span>
              {/* Toggle entre os 2 modos */}
              <div
                className="mb-2 inline-flex rounded-full p-0.5 text-[11px] font-bold"
                style={{
                  background: "rgba(15,14,12,0.05)",
                  border: "0.5px solid var(--hairline)",
                }}
              >
                {([
                  { v: "RELATIVO" as const, label: "Prazo (dias/meses)" },
                  { v: "DATA_CERTA" as const, label: "Data certa" },
                  { v: "SOB_DEMANDA" as const, label: "Sob demanda" },
                ]).map((opt) => {
                  const ativo = prazoEntregaModo === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setPrazoEntregaModo(opt.v)}
                      className="rounded-full px-3 py-1 transition"
                      style={{
                        background: ativo ? "var(--primary-deep)" : "transparent",
                        color: ativo ? "white" : "var(--text-soft)",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {prazoEntregaModo === "RELATIVO" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="prazoEntregaDias"
                    min="0"
                    placeholder="Quantidade"
                    defaultValue={
                      dados?.prazoEntregaDias?.toString() ?? vi?.prazoEntregaDias?.toString() ?? ""
                    }
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                  />
                  <select
                    value={prazoEntregaUnidade}
                    onChange={(ev) =>
                      setPrazoEntregaUnidade(ev.target.value as "DIAS" | "MESES")
                    }
                    className="rounded-xl px-3 py-3 text-sm font-bold uppercase"
                    style={{
                      border: "0.5px solid var(--hairline)",
                      background: "rgba(255,255,255,0.7)",
                      color: "var(--text)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    <option value="DIAS">Dias</option>
                    <option value="MESES">Meses</option>
                  </select>
                </div>
              ) : prazoEntregaModo === "DATA_CERTA" ? (
                <input
                  type="date"
                  name="dataEntregaCerta"
                  defaultValue={vi?.dataEntregaCerta ?? ""}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                />
              ) : (
                <input
                  type="date"
                  disabled
                  placeholder="A definir"
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    background: "rgba(15,14,12,0.04)",
                    opacity: 0.6,
                    cursor: "not-allowed",
                  }}
                />
              )}
              <span className="mt-1 block text-[11px]" style={{ color: "var(--text-mute)" }}>
                {prazoEntregaModo === "RELATIVO"
                  ? "Prazo contado a partir do pedido/empenho."
                  : prazoEntregaModo === "DATA_CERTA"
                    ? "Data específica de execução (ex.: locação para evento)."
                    : "Data definida posteriormente pelo cliente — preenchida no Empenho/Ordem."}
              </span>
            </div>

            <Field
              label="Prazo de pagamento (dias)"
              name="prazoPagamentoDias"
              type="number"
              min="0"
              erro={e.prazoPagamentoDias}
              span={1}
              defaultValue={dados?.prazoPagamentoDias?.toString() ?? vi?.prazoPagamentoDias?.toString() ?? ""}
            />

            {/* Marco de reajuste — mesma estrutura da ARP */}
            <div className="col-span-4">
              <span
                className="mb-1.5 block text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                Marco de reajuste (alerta em +12 meses)
              </span>
              <div className="grid grid-cols-4 gap-3">
                <select
                  value={marcoReajusteOrigem}
                  onChange={(ev) => setMarcoReajusteOrigem(ev.target.value)}
                  className="col-span-2 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ border: "0.5px solid var(--hairline)", background: "rgba(255,255,255,0.7)" }}
                >
                  <option value="">— Sem reajuste / não aplicável —</option>
                  <option value="ORCAMENTO_ESTIMADO">Orçamento estimado</option>
                  <option value="ASSINATURA">Assinatura do Contrato</option>
                  <option value="OMISSA">Omisso</option>
                </select>
                <input
                  type="date"
                  value={
                    marcoReajusteOrigem === "ORCAMENTO_ESTIMADO"
                      ? marcoOrcamentoEstimado
                      : marcoReajusteOrigem === "ASSINATURA"
                        ? dataAssinaturaState
                        : ""
                  }
                  onChange={(ev) => {
                    if (marcoReajusteOrigem === "ORCAMENTO_ESTIMADO") {
                      setMarcoOrcamentoEstimado(ev.target.value);
                    }
                  }}
                  disabled={marcoReajusteOrigem !== "ORCAMENTO_ESTIMADO"}
                  className="col-span-2 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{
                    border: "0.5px solid var(--hairline)",
                    background:
                      marcoReajusteOrigem === "ORCAMENTO_ESTIMADO"
                        ? "rgba(255,255,255,0.7)"
                        : "rgba(15,14,12,0.04)",
                    opacity: marcoReajusteOrigem === "OMISSA" || marcoReajusteOrigem === "" ? 0.5 : 1,
                  }}
                />
              </div>
              <span className="mt-1 block text-[11px]" style={{ color: "var(--text-mute)" }}>
                {marcoReajusteOrigem === "ASSINATURA" &&
                  "Auto-preenchida com a Data de assinatura do contrato."}
                {marcoReajusteOrigem === "ORCAMENTO_ESTIMADO" &&
                  "Informe a data do orçamento estimado."}
                {(!marcoReajusteOrigem || marcoReajusteOrigem === "OMISSA") &&
                  "Cláusula omissa = sem reajuste programado."}
              </span>
            </div>
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
                defaultValue={vi?.marcoInicialDescricao ?? ""}
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
              <ParcelasEditor erro={e.parcelas} iniciais={vi?.parcelas} />
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
          <EnderecosEntregaEditor iniciais={vi?.enderecosEntrega} />
        </Secao>

        <Secao titulo="Pontos focais do órgão (Lei 14.133 art. 117)">
          <p className="mb-3 text-xs text-slate-600">
            Pessoas-chave para gestão e fiscalização. Adicione pelo menos o Gestor — Fiscais
            Técnico e Administrativo são recomendados.
          </p>
          <PontosFocaisEditor iniciais={vi?.pontosFocais} />
        </Secao>

        <Secao titulo="Itens contratados">
          {ataSelecionada && (
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Vinculando à Ata <strong>{ataSelecionada.label}</strong>. Selecione cada item da Ata na primeira coluna — o saldo será validado automaticamente.
            </p>
          )}
          <ItensEditor
            ataItens={ataSelecionada?.itens}
            itensIniciais={vi?.itens ?? dados?.itens}
            permitirLotes={false}
            sugestoesIa={sugestoesItens}
          />
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
            <strong>Erro ao cadastrar Contrato:</strong> {state.erro}
          </div>
        )}

        <div className="flex gap-3">
          <SubmitButton>{modo === "editar" ? "Salvar alterações" : "Cadastrar Contrato"}</SubmitButton>
          <Link
            href={modo === "editar" && contratoId ? `/contratos/${contratoId}` : "/contratacoes/nova"}
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

type ParcelaState = { id: string; numero: number; prazoDias: string; descricao: string; valorEstimado: string };

function ParcelasEditor({
  erro,
  iniciais,
}: {
  erro?: string;
  iniciais?: {
    id: string;
    numero: number;
    prazoDias: number;
    descricao: string | null;
    valorEstimado: number | null;
  }[];
}) {
  const [parcelas, setParcelas] = useState<ParcelaState[]>(
    iniciais && iniciais.length > 0
      ? iniciais.map((p) => ({
          id: p.id,
          numero: p.numero,
          prazoDias: String(p.prazoDias),
          descricao: p.descricao ?? "",
          valorEstimado: p.valorEstimado != null ? String(p.valorEstimado) : "",
        }))
      : [
          { id: "", numero: 1, prazoDias: "30", descricao: "", valorEstimado: "" },
          { id: "", numero: 2, prazoDias: "60", descricao: "", valorEstimado: "" },
        ],
  );

  const atualizar = (idx: number, campo: keyof ParcelaState, valor: string) => {
    setParcelas((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [campo]: campo === "numero" ? Number(valor) : valor } : p)),
    );
  };

  const adicionar = () => {
    setParcelas((prev) => [
      ...prev,
      { id: "", numero: prev.length + 1, prazoDias: "", descricao: "", valorEstimado: "" },
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
            <tr key={p.id || `nova-${idx}`} className="border-b border-slate-100">
              <td className="py-2 pr-2">
                {p.id && (
                  <input type="hidden" name={`parcelas[${idx}][id]`} value={p.id} />
                )}
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
