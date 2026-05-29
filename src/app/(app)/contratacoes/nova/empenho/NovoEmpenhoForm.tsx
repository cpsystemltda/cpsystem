"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Field, Select } from "@/components/Field";
import { AJUDA } from "@/lib/textosAjuda";
import { SubmitButton } from "@/components/SubmitButton";
import { ItensEditor, type AtaItemRef } from "@/components/ItensEditor";
import { UploadPdfPanel } from "@/components/UploadPdfPanel";
import { EnderecosEntregaEditor, PontosFocaisEditor } from "@/components/EditoresOrgao";
import type { ItemInicial } from "@/components/ItensEditor";
import { criarEmpenhoAction, editarEmpenhoAction } from "@/app/actions/contratacoes";
import { extrairEmpenhoPdfAction } from "@/app/actions/iaExtracao";
import { matchItensIaAction, type Sugestao as SugestaoIa } from "@/app/actions/iaMatchItens";
import { usePrefillIa } from "@/lib/usePrefillIa";
import { OPCOES_TIPO } from "@/lib/validators";
import type { EmpenhoExtraido } from "@/lib/extrairAta";
import {
  labelInstrumento,
  labelNumeroInstrumento,
} from "@/lib/instrumentoLabel";
import type { InstrumentoContratual } from "@/generated/prisma/client";
import { TextareaGlass, CnpjInput } from "@/components/forms/glass";
import {
  calcularVigenciaFim,
  detectarPrazoVigencia,
} from "@/components/forms/vigencia";
import { AnexosAdicionaisEditor } from "@/components/forms/AnexosAdicionaisEditor";

type EmpresaOpt = { value: string; label: string };
type AtaOpt = { value: string; label: string; itens: AtaItemRef[] };

// Dados herdáveis do Contrato pai pra pré-preencher o form de execução.
// Opcional: quando ausente (rota editar), o seletor de contrato não auto-preenche.
type ContratoDados = {
  empresaId: string;
  tipo: string;
  processoAdministrativo: string;
  numeroLicitacao: string | null;
  objeto: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string;
  orgaoEmail: string | null;
  orgaoTelefone: string | null;
  prazoEntregaDias: number | null;
  prazoEntregaUnidade: "DIAS" | "MESES" | "ANOS";
  prazoEntregaModo: "RELATIVO" | "DATA_CERTA" | "PRAZO_CERTO";
  dataEntregaCerta: string | null;
  dataEntregaInicio?: string | null;
  dataEntregaFim?: string | null;
  prazoPagamentoDias: number | null;
  enderecosEntrega: { id: string; rotulo: string | null; endereco: string }[];
  pontosFocais: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    funcao: string;
    funcaoDescricao: string | null;
  }[];
  // Itens do contrato pai — auto-populam a tabela de itens do empenho.
  // Usuário só ajusta quantidade (resto vem preenchido).
  itens: {
    descricao: string;
    unidade: string;
    quantidade: number;
    marca: string | null;
    valorUnitario: number;
  }[];
};
type ContratoOpt = { value: string; label: string; ataId: string | null; dados?: ContratoDados };

export type EmpenhoValoresIniciais = {
  empresaId: string;
  ataId: string | null;
  contratoId: string | null;
  instrumento?: InstrumentoContratual;
  tipo: string;
  numero: string;
  numeroOrdemFornecimento: string | null;
  processoAdministrativo: string;
  procedimentoSelecao: string | null;
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
  prazoEntregaUnidade?: "DIAS" | "MESES" | "ANOS";
  prazoEntregaModo?: "RELATIVO" | "DATA_CERTA" | "PRAZO_CERTO";
  dataEntregaCerta?: string | null;
  dataEntregaInicio?: string | null;
  dataEntregaFim?: string | null;
  prazoPagamentoDias: number | null;
  // Campos específicos por instrumento (todos opcionais; só aparecem no
  // form quando o instrumento correspondente está selecionado).
  classificacaoOrcamentaria?: string | null;
  signatario?: string | null;
  dataAssinatura?: string | null;
  departamentoEmissor?: string | null;
  pontoColeta?: string | null;
  contatoRecebedor?: string | null;
  fiscalResponsavel?: string | null;
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
  instrumento: instrumentoProp,
}: {
  empresas: EmpresaOpt[];
  atas: AtaOpt[];
  contratos: ContratoOpt[];
  modo?: "criar" | "editar";
  empenhoId?: string;
  valoresIniciais?: EmpenhoValoresIniciais;
  // Instrumento selecionado no seletor secundário. Em modo editar vem do
  // próprio registro (valoresIniciais.instrumento). Default NOTA_EMPENHO
  // mantém retrocompat com chamadores antigos.
  instrumento?: InstrumentoContratual;
}) {
  const instrumento: InstrumentoContratual =
    instrumentoProp ?? valoresIniciais?.instrumento ?? "NOTA_EMPENHO";
  const nomeInstr = labelInstrumento(instrumento);
  const labelNumero = labelNumeroInstrumento(instrumento);
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

  // Contrato selecionado — usado pra herdar campos no modo "Derivado de
  // Contrato". O `key` do form muda quando contratoId muda, então os
  // defaultValues abaixo são reaplicados.
  const contratoSelecionado = origem === "contrato"
    ? contratos.find((c) => c.value === contratoId)
    : undefined;
  const heranca = contratoSelecionado?.dados;

  // Vigência foi retirada do form (decisão Igor) — calculada na server
  // action a partir da Ata/Contrato pai. Mantemos os imports só pra evitar
  // warning lint até decidir se removemos do helper compartilhado.

  // Prazo entrega 2 modos (Ajuste 5)
  const [prazoEntregaModo, setPrazoEntregaModo] = useState<"RELATIVO" | "DATA_CERTA" | "PRAZO_CERTO">(
    vi?.prazoEntregaModo ?? "RELATIVO",
  );
  const [prazoEntregaUnidade, setPrazoEntregaUnidade] = useState<"DIAS" | "MESES" | "ANOS">(
    vi?.prazoEntregaUnidade ?? "DIAS",
  );

  // PDF + badge AUTO (Ajuste 6 — single PDF principal; múltiplos anexos
  // adicionais ficam em outra seção mais abaixo)
  const [arquivoPdfUrl, setArquivoPdfUrl] = useState<string | null>(null);
  const [arquivoPdfNome, setArquivoPdfNome] = useState<string | null>(null);
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());
  // Anexos adicionais cadastrados na criação (PDFs de Ordem de Fornecimento,
  // aditivos etc). Cada um tem URL persistida (Vercel Blob) + nome + categoria.
  const [anexosAdicionais, setAnexosAdicionais] = useState<
    { url: string; nome: string; categoria: string }[]
  >([]);

  useEffect(() => {
    if (!dados) return;
    // Vigência não é mais campo do form; ignoramos `dados.vigenciaInicio/Fim`
    // mesmo que a IA tenha extraído — a action calcula a partir da Ata/Contrato.
    const auto = new Set<string>();
    const d = dados as unknown as Record<string, unknown>;
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) auto.add(k);
    }
    setCamposAuto(auto);
  }, [dados]);

  // Sincroniza estados controlados quando troca o contrato selecionado
  // (defaultValue só age na montagem, então estado precisa de useEffect).
  useEffect(() => {
    if (!heranca) return;
    setPrazoEntregaModo(heranca.prazoEntregaModo);
    if (heranca.prazoEntregaUnidade) setPrazoEntregaUnidade(heranca.prazoEntregaUnidade);
  }, [heranca]);

  const ataSelecionada = origem === "ata" ? atas.find((a) => a.value === ataId) : undefined;

  // Quando deriva de Ata ou Contrato, pré-popula a tabela de itens com
  // descrição/unidade/valor unitário do pai — usuário só ajusta quantidade.
  // (Decisão UX da Regina: cadastrar execução fica muito mais rápido.)
  const itensDerivadosDoPai: ItemInicial[] | undefined =
    modo === "criar"
      ? ataSelecionada && ataSelecionada.itens.length > 0
        ? ataSelecionada.itens.map((it) => ({
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade: 0, // usuário preenche
            marca: null,
            valorUnitario: it.valorUnitario,
            // Vincula automaticamente ao item da Ata (saldo é validado na action)
            ataItemId: it.id,
          }))
        : contratoSelecionado?.dados?.itens && contratoSelecionado.dados.itens.length > 0
          ? contratoSelecionado.dados.itens.map((it) => ({
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: 0, // usuário preenche
              marca: it.marca ?? null,
              valorUnitario: it.valorUnitario,
            }))
          : undefined
      : undefined;

  // Quando troca de contrato (ou volta pra origem "livre"), remonta o form
  // pra que defaultValue/iniciais sejam reaplicados com os dados do contrato.
  const formKey = dados
    ? `auto-${dados.numero}`
    : heranca
      ? `contrato-${contratoId}`
      : "manual";

  // Key específica do ItensEditor — remonta quando muda o pai (Ata/Contrato)
  // ou quando a IA gera novos itens. Sem isso, o useState do editor não
  // pegaria as novas linhas pré-populadas.
  const itensEditorKey = dados
    ? `ia-${dados.itens.length}`
    : ataSelecionada
      ? `ata-${ataSelecionada.value}`
      : contratoSelecionado
        ? `contrato-${contratoSelecionado.value}`
        : "manual";

  // M9 IA — matching dos itens extraídos contra a Ata vinculada
  const [sugestoesItens, setSugestoesItens] = useState<SugestaoIa[]>([]);

  // M9 IA — prefill via UploadInteligenteCard
  const prefill = usePrefillIa<EmpenhoExtraido>("EMPENHO");
  useEffect(() => {
    if (!prefill) return;
    if (prefill.dados) setDados(prefill.dados);
    if (prefill.arquivoUrl) setArquivoPdfUrl(prefill.arquivoUrl);
    if (prefill.arquivoNome) setArquivoPdfNome(prefill.arquivoNome);
  }, [prefill]);
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
        href={modo === "editar" ? "/contratacoes/nova" : "/contratacoes/nova/fornecimento"}
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
            {modo === "editar" ? `Editar registro · ${nomeInstr}` : `Nova contratação · ${nomeInstr}`}
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
              {modo === "editar" ? `${nomeInstr} ${vi?.numero ?? ""}` : nomeInstr}
            </em>
          </h1>
          <p
            className="mt-3 max-w-[640px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            {modo === "editar"
              ? `Ajuste qualquer campo. Alterações em valores monetários, vigências e CNPJs pedem confirmação. Tudo fica registrado no histórico. Não é possível editar ${nomeInstr.toLowerCase()} já pago.`
              : "Instrumento contratual substitutivo do Termo de Contrato (art. 95, Lei 14.133/2021). Pode ser autônomo, derivado de Ata (SRP) ou de Contrato existente."}
          </p>
        </div>
      </header>

      {/* Upload com IA — único pra todos os instrumentos (NE, AE, OS, AC,
          Carta-Contrato). A IA extrai campos comuns (número, processo, órgão,
          itens, valores) — se algo específico do instrumento não vier, o
          usuário ajusta manualmente. Diretriz: tudo no sistema deve ter IA. */}
      {modo !== "editar" && (
        <div className="mt-6">
          <UploadPdfPanel
            titulo={`Preencher automaticamente a partir do PDF da ${nomeInstr}`}
            descricao={`Anexe o PDF do documento. A IA extrai número, identificador, processo, órgão, vigência, prazos e itens. Você confere e edita antes de salvar.${
              instrumento !== "NOTA_EMPENHO"
                ? " (Treinada principalmente em Notas de Empenho — para outros instrumentos pode ser necessário ajuste manual.)"
                : ""
            }`}
            action={extrairEmpenhoPdfAction}
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
          } else {
            // No criar: pede confirmação dizendo qual instrumento será salvo
            // (evita usuário cadastrar AE achando que era empenho, etc.).
            const ok = window.confirm(
              `Confirmar cadastro como ${nomeInstr}?`,
            );
            if (!ok) {
              ev.preventDefault();
              ev.stopPropagation();
            }
          }
        }}
      >
        <input type="hidden" name="instrumento" value={instrumento} />
        {modo === "editar" && empenhoId && (
          <input type="hidden" name="empenhoId" value={empenhoId} />
        )}
        {/* PDF da IA — cria Anexo (CONTRATUAL) após save */}
        {arquivoPdfUrl && (
          <>
            <input type="hidden" name="arquivoPdfUrl" value={arquivoPdfUrl} />
            <input type="hidden" name="arquivoPdfNome" value={arquivoPdfNome ?? ""} />
          </>
        )}
        {/* Anexos adicionais — cada um vira um registro Anexo após save */}
        {anexosAdicionais.map((a, i) => (
          <div key={i}>
            <input type="hidden" name={`anexosAdicionais[${i}][url]`} value={a.url} />
            <input type="hidden" name={`anexosAdicionais[${i}][nome]`} value={a.nome} />
            <input type="hidden" name={`anexosAdicionais[${i}][categoria]`} value={a.categoria} />
          </div>
        ))}
        {/* Hidden inputs dos campos controlados. Vigência não é mais enviada
            pelo form — a server action calcula a partir da Ata/Contrato pai. */}
        <input type="hidden" name="prazoEntregaModo" value={prazoEntregaModo} />
        <input type="hidden" name="prazoEntregaUnidade" value={prazoEntregaUnidade} />
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
            <>
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
              {heranca && modo !== "editar" && (
                <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Dados do contrato herdados (órgão, objeto, prazos, endereços e pontos focais). Confira
                  e ajuste o que for específico desta execução — número, data de recebimento, vigência e itens
                  continuam por preencher.
                </p>
              )}
            </>
          )}
        </Secao>

        <Secao titulo="Identificação">
          <div className="grid grid-cols-4 gap-4">
            <Select label="Empresa" name="empresaId" options={empresas} required erro={e.empresaId} span={2} defaultValue={heranca?.empresaId ?? vi?.empresaId} />
            <Select label="Tipo de objeto" name="tipo" options={OPCOES_TIPO} required erro={e.tipo} span={2} defaultValue={heranca?.tipo ?? vi?.tipo} ajuda={AJUDA.tipoContrato} />
            <Field
              label={`${labelNumero} (nº/ano)`}
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
              defaultValue={dados?.processoAdministrativo ?? heranca?.processoAdministrativo ?? vi?.processoAdministrativo}
            />
            {/* Procedimento de seleção removido do form (M3.3 ajuste 2,
                decisão Igor). Quando vinculado a Ata/Contrato a info é
                herdada; quando avulso é dispensável. Schema mantém o campo
                opcional pra preservar dados legacy. */}
            <Field
              label="Nº da Licitação (opcional)"
              name="numeroLicitacao"
              erro={e.numeroLicitacao}
              span={2}
              defaultValue={dados?.numeroLicitacao ?? heranca?.numeroLicitacao ?? vi?.numeroLicitacao ?? ""}
            />
            <TextareaGlass
              label="Objeto"
              name="objeto"
              required
              erro={e.objeto}
              span={4}
              minRows={3}
              defaultValue={dados?.objeto ?? heranca?.objeto ?? vi?.objeto}
              auto={camposAuto.has("objeto") || (!!heranca && !dados)}
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
              defaultValue={dados?.orgaoNome ?? heranca?.orgaoNome ?? vi?.orgaoNome}
            />
            <CnpjInput
              label="CNPJ do órgão"
              name="orgaoCnpj"
              required
              erro={e.orgaoCnpj}
              span={2}
              defaultValue={dados?.orgaoCnpj ?? heranca?.orgaoCnpj ?? vi?.orgaoCnpj}
              auto={camposAuto.has("orgaoCnpj") || (!!heranca && !dados)}
            />
            <Field
              label="Endereço"
              name="orgaoEndereco"
              required
              erro={e.orgaoEndereco}
              span={4}
              defaultValue={dados?.orgaoEndereco ?? heranca?.orgaoEndereco ?? vi?.orgaoEndereco}
            />
            <Field
              label="E-mail"
              name="orgaoEmail"
              type="email"
              erro={e.orgaoEmail}
              span={2}
              defaultValue={dados?.orgaoEmail ?? heranca?.orgaoEmail ?? vi?.orgaoEmail ?? ""}
            />
            <Field
              label="Telefone"
              name="orgaoTelefone"
              erro={e.orgaoTelefone}
              span={2}
              defaultValue={dados?.orgaoTelefone ?? heranca?.orgaoTelefone ?? vi?.orgaoTelefone ?? ""}
            />
          </div>
        </Secao>

        <Secao titulo="Datas e prazos">
          <div className="grid grid-cols-4 gap-4">
            {/* Ajuste 3 — rótulo "Data de recebimento do documento" (a empresa
                não controla quando o órgão emite o documento; o que conta é
                quando chegou pra ela). Campo no banco continua `dataEmissao`
                pra manter dados antigos. */}
            <Field
              label="Data de recebimento do documento"
              name="dataEmissao"
              type="date"
              required
              erro={e.dataEmissao}
              span={1}
              defaultValue={dados?.dataEmissao ?? vi?.dataEmissao}
            />
            {/* Vigência (início/prazo/fim) foi retirada da UI a pedido do Igor:
                empenho/AE/OS não tem vigência própria — herda da Ata/Contrato
                pai. A server action preenche automaticamente. */}

            {/* Ajuste 5 — Prazo de entrega com 2 modos (RELATIVO ou DATA_CERTA) */}
            <div className="col-span-2">
              <span
                className="mb-1.5 block text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                Prazo de entrega/execução
              </span>
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
                  { v: "PRAZO_CERTO" as const, label: "Prazo certo (intervalo)" },
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
              {prazoEntregaModo === "RELATIVO" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    name="prazoEntregaDias"
                    min="0"
                    placeholder="Quantidade"
                    defaultValue={
                      dados?.prazoEntregaDias?.toString() ?? heranca?.prazoEntregaDias?.toString() ?? vi?.prazoEntregaDias?.toString() ?? ""
                    }
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                  />
                  <select
                    value={prazoEntregaUnidade}
                    onChange={(ev) =>
                      setPrazoEntregaUnidade(ev.target.value as "DIAS" | "MESES" | "ANOS")
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
              )}
              {prazoEntregaModo === "DATA_CERTA" && (
                <input
                  type="date"
                  name="dataEntregaCerta"
                  defaultValue={heranca?.dataEntregaCerta ?? vi?.dataEntregaCerta ?? ""}
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium"
                />
              )}
              {prazoEntregaModo === "PRAZO_CERTO" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    name="dataEntregaInicio"
                    defaultValue={vi?.dataEntregaInicio ?? ""}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                  />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-soft)" }}>
                    a
                  </span>
                  <input
                    type="date"
                    name="dataEntregaFim"
                    defaultValue={vi?.dataEntregaFim ?? ""}
                    className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                  />
                </div>
              )}
            </div>
            <Field
              label="Prazo de pagamento (dias)"
              name="prazoPagamentoDias"
              type="number"
              min="0"
              erro={e.prazoPagamentoDias}
              span={1}
              defaultValue={dados?.prazoPagamentoDias?.toString() ?? heranca?.prazoPagamentoDias?.toString() ?? vi?.prazoPagamentoDias?.toString() ?? ""}
            />
            <Field
              label="Nº da Ordem de Fornecimento (se houver)"
              name="numeroOrdemFornecimento"
              placeholder="OF nº/ano"
              span={1}
              defaultValue={vi?.numeroOrdemFornecimento ?? ""}
            />
          </div>
        </Secao>

        {/* Ajuste 6 — Anexos adicionais (Ordem de Fornecimento, aditivos, etc.) */}
        {modo !== "editar" && (
          <Secao titulo="Anexos adicionais (opcional)">
            <p className="mb-3 text-xs" style={{ color: "var(--text-soft)" }}>
              PDFs complementares: Ordem de Fornecimento, aditivos, apostilamentos.
              Para o PDF principal use o painel da IA acima.
            </p>
            <AnexosAdicionaisEditor
              anexos={anexosAdicionais}
              onChange={setAnexosAdicionais}
            />
          </Secao>
        )}

        {/* Bloco "Detalhes — <instrumento>" foi removido (decisão Igor).
            Campos específicos por instrumento (classificacaoOrcamentaria,
            signatario, dataAssinatura, departamentoEmissor, pontoColeta,
            contatoRecebedor, fiscalResponsavel) continuam no schema como
            opcionais — backend aceita criar sem eles. */}

        <Secao titulo="Endereços de entrega/execução">
          <p className="mb-3 text-xs text-slate-600">
            Locais onde este {nomeInstr.toLowerCase()} será cumprido.
          </p>
          <EnderecosEntregaEditor iniciais={heranca?.enderecosEntrega ?? vi?.enderecosEntrega} />
        </Secao>

        <Secao titulo="Pontos focais do órgão (Lei 14.133 art. 117)">
          <p className="mb-3 text-xs text-slate-600">
            Gestor + Fiscais Técnico/Administrativo do contrato.
          </p>
          <PontosFocaisEditor iniciais={heranca?.pontosFocais ?? vi?.pontosFocais} />
        </Secao>

        <Secao titulo="Itens">
          {ataSelecionada && (
            <p className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Selecione cada item da Ata na primeira coluna — o saldo será validado.
            </p>
          )}
          <ItensEditor
            key={itensEditorKey}
            ataItens={ataSelecionada?.itens}
            itensIniciais={vi?.itens ?? dados?.itens ?? itensDerivadosDoPai}
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
            <strong>Erro ao cadastrar {nomeInstr}:</strong> {state.erro}
          </div>
        )}

        <div className="flex gap-3">
          <SubmitButton>{modo === "editar" ? "Salvar alterações" : `Cadastrar ${nomeInstr}`}</SubmitButton>
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
