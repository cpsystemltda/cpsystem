"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Sparkles,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  MapPin,
  Users,
  Building2,
  FileText,
  Calendar,
  Package,
} from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { TooltipAjuda } from "@/components/TooltipAjuda";
import { AJUDA } from "@/lib/textosAjuda";
import { ItensEditor } from "@/components/ItensEditor";
import type { ItemInicial } from "@/components/ItensEditor";
import { criarAtaAction, editarAtaAction } from "@/app/actions/contratacoes";
import { extrairAtaPdfAction } from "@/app/actions/iaExtracao";
import {
  OPCOES_PROCEDIMENTO,
  OPCOES_TIPO,
  OPCOES_FUNCAO_PONTO_FOCAL,
  OPCOES_MARCO_REAJUSTE,
} from "@/lib/validators";
import type { AtaExtraida } from "@/lib/extrairAta";
import { usePrefillIa } from "@/lib/usePrefillIa";
import {
  BadgeAuto,
  FieldGlass,
  TextareaGlass,
  SelectGlass,
  CnpjInput,
  CepInput,
} from "@/components/forms/glass";
import {
  calcularVigenciaFim,
  detectarPrazoVigencia,
  formatarCepInput,
  formatarCnpjInput,
} from "@/components/forms/vigencia";

type EmpresaOpt = { value: string; label: string };

export type AtaValoresIniciais = {
  empresaId: string;
  numero: string;
  processoAdministrativo: string;
  tipo: string;
  procedimentoSelecao: string;
  numeroLicitacao: string | null;
  idAtaPncp: string | null;
  objeto: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string;
  orgaoEmail: string | null;
  orgaoTelefone: string | null;
  dataAssinatura: string; // YYYY-MM-DD
  dataPublicacao: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoEntregaUnidade?: "DIAS" | "MESES";
  prazoEntregaNaoAplica: boolean;
  prazoPagamentoDias: number | null;
  marcoReajusteOrigem: string | null;
  marcoOrcamentoEstimado: string | null;
  aceitaCarona: boolean;
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
  orgaosParticipantes: {
    id: string;
    tipo: string;
    nome: string;
    cnpj: string;
    endereco: string;
    email: string | null;
    telefone: string | null;
  }[];
};

/* ============================================================
   Bloco da seção (glass dark)
   ============================================================ */
function SecaoGlass({
  numero,
  titulo,
  subtitulo,
  icone: Icone,
  children,
}: {
  numero: string;
  titulo: string;
  subtitulo?: string;
  icone?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
}) {
  return (
    <section className="glass overflow-hidden rounded-[24px]">
      <header
        className="relative z-[1] flex items-center gap-4 px-8 py-5"
        style={{ borderBottom: "0.5px solid var(--hairline)" }}
      >
        <div
          className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-extrabold"
          style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.06))",
            border: "0.5px solid rgba(212,175,55,0.4)",
            color: "var(--primary-deep)",
            letterSpacing: "-0.04em",
          }}
        >
          {numero}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {Icone && <Icone className="h-4 w-4" style={{ color: "var(--primary)" }} />}
            <h2
              className="text-[20px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              {titulo}
            </h2>
          </div>
          {subtitulo && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-mute)" }}>
              {subtitulo}
            </p>
          )}
        </div>
      </header>
      <div className="relative z-[1] px-8 py-6">{children}</div>
    </section>
  );
}

/* ============================================================
   Form principal
   ============================================================ */
// Rótulos amigáveis pra cada path de erro do schema, mostrados na lista
// de erros no topo do form.
const ROTULO_CAMPO: Record<string, string> = {
  empresaId: "Empresa",
  numero: "Número da Ata",
  processoAdministrativo: "Processo administrativo",
  procedimentoSelecao: "Procedimento de seleção",
  numeroLicitacao: "Nº do Pregão Eletrônico",
  idAtaPncp: "ID Ata no PNCP",
  tipo: "Tipo de objeto",
  objeto: "Objeto",
  orgaoNome: "Nome do órgão",
  orgaoCnpj: "CNPJ do órgão",
  orgaoEndereco: "Endereço do órgão",
  orgaoEmail: "E-mail do órgão",
  orgaoTelefone: "Telefone do órgão",
  dataAssinatura: "Data de assinatura",
  dataPublicacao: "Data de publicação",
  vigenciaInicio: "Vigência (início)",
  vigenciaFim: "Vigência (fim)",
  prazoEntregaDias: "Prazo de entrega",
  prazoPagamentoDias: "Prazo de pagamento",
  marcoOrcamentoEstimado: "Data inicial do marco",
  marcoReajusteOrigem: "Marco de reajuste",
  itens: "Itens registrados",
  enderecosEntrega: "Endereços de entrega",
  pontosFocais: "Pontos focais",
  orgaosParticipantes: "Órgãos participantes",
};

function rotularErro(path: string): string {
  // Caminhos aninhados (itens.0.descricao) → "Item 1 · Descrição"
  const partes = path.split(".");
  const root = partes[0];
  if (partes.length >= 2 && /^\d+$/.test(partes[1])) {
    const idx = Number(partes[1]) + 1;
    const sub = partes[2] ? ` · ${partes[2]}` : "";
    return `${ROTULO_CAMPO[root] ?? root} ${idx}${sub}`;
  }
  return ROTULO_CAMPO[path] ?? path;
}

export default function NovaAtaForm({
  empresas,
  empresaPreSelecionada,
  modo = "criar",
  ataId,
  valoresIniciais,
}: {
  empresas: EmpresaOpt[];
  empresaPreSelecionada?: string;
  modo?: "criar" | "editar";
  ataId?: string;
  valoresIniciais?: AtaValoresIniciais;
}) {
  const action = modo === "editar" ? editarAtaAction : criarAtaAction;
  const [state, formAction] = useActionState(action, null);
  const e = state?.campos ?? {};
  const v = (state?.valores ?? {}) as Record<string, string>;
  const errosResumo = Object.entries(e);
  const resumoRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [extracaoErro, setExtracaoErro] = useState<string | null>(null);
  const [dados, setDados] = useState<AtaExtraida | null>(null);
  const [pdfNome, setPdfNome] = useState<string | null>(null);
  // URL persistida do PDF (Vercel Blob) e nome original — preenchidos quando
  // o usuário sobe o PDF pra IA. Vão como hidden inputs e criam o Anexo no save.
  const [arquivoPdfUrl, setArquivoPdfUrl] = useState<string | null>(null);
  const [arquivoPdfNome, setArquivoPdfNome] = useState<string | null>(null);

  // M9 IA — prefill via UploadInteligenteCard (dashboard)
  const prefill = usePrefillIa<AtaExtraida>("ATA");
  useEffect(() => {
    if (!prefill) return;
    if (prefill.dados) {
      setDados(prefill.dados);
      setPdfNome(prefill.arquivoNome ?? null);
    }
    if (prefill.arquivoUrl) setArquivoPdfUrl(prefill.arquivoUrl);
    if (prefill.arquivoNome) setArquivoPdfNome(prefill.arquivoNome);
  }, [prefill]);
  // Conjunto de campos preenchidos pela IA — usado pro badge "Auto".
  // Quando o usuário edita um campo, ele sai da set (= revisado/sobrescrito).
  const [camposAuto, setCamposAuto] = useState<Set<string>>(new Set());

  // Em modo edição, valoresIniciais é o fallback final pra cada campo.
  // Helper pra ler string-like sem espalhar `?? valoresIniciais?.foo` em
  // cada defaultValue (escala mal e é fácil de errar).
  const vi = valoresIniciais;

  // Após erro de validação: rola até o resumo de erros e foca o primeiro
  // campo problemático
  useEffect(() => {
    if (errosResumo.length === 0) return;
    resumoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const primeiro = errosResumo[0]?.[0];
    if (primeiro) {
      const sel = primeiro.includes(".") ? primeiro.split(".")[0] : primeiro;
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${sel}"]`);
      el?.focus({ preventScroll: true });
    }
  }, [state]);

  // Estados controlados (PDF apontamentos / pré-preenchidos em modo edição)
  const [prazoNaoAplica, setPrazoNaoAplica] = useState(vi?.prazoEntregaNaoAplica ?? false);
  // Unidade do prazo de entrega (DIAS ou MESES). Default DIAS pra retrocompat
  // — todos os registros antigos foram cadastrados em dias.
  const [prazoEntregaUnidade, setPrazoEntregaUnidade] = useState<"DIAS" | "MESES">(
    (vi?.prazoEntregaUnidade as "DIAS" | "MESES") ?? "DIAS",
  );
  const [marcoOrigem, setMarcoOrigem] = useState<string>(vi?.marcoReajusteOrigem ?? "");
  const [temParticipantes, setTemParticipantes] = useState(
    (vi?.orgaosParticipantes?.length ?? 0) > 0,
  );

  // Endereço auto-preenchido pelo CEP do órgão gerenciador
  const [orgaoEndereco, setOrgaoEndereco] = useState(vi?.orgaoEndereco ?? "");

  // Vigência: usuário preenche Início + Prazo (qtd + unidade). Sistema
  // calcula Fim automaticamente (readonly). Default ARP = 1 ano (Lei 14.133).
  const [vigenciaInicio, setVigenciaInicio] = useState<string>(
    vi?.vigenciaInicio ?? "",
  );
  // Detecta unidade/qtd a partir da vigenciaFim cadastrada — usado em modo
  // editar pra preencher o campo Prazo com a unidade certa quando possível.
  const prazoDetectado = detectarPrazoVigencia(
    vi?.vigenciaInicio ?? "",
    vi?.vigenciaFim ?? "",
  );
  const [prazoVigenciaQtd, setPrazoVigenciaQtd] = useState<number>(
    prazoDetectado?.qtd ?? 1,
  );
  const [prazoVigenciaUnidade, setPrazoVigenciaUnidade] = useState<
    "DIAS" | "MESES" | "ANOS"
  >(prazoDetectado?.unidade ?? "ANOS");
  // vigenciaFim sempre derivada do cálculo (Início + Prazo) — não editável.
  const vigenciaFim = calcularVigenciaFim(
    vigenciaInicio,
    prazoVigenciaQtd,
    prazoVigenciaUnidade,
  );
  const vigenciaFimNoPassado = vigenciaFim
    ? new Date(vigenciaFim + "T23:59:59") < new Date()
    : false;

  // Quando a IA preenche o form (dados muda), atualiza state local de
  // Início e Prazo de vigência pra refletir o que veio do PDF.
  useEffect(() => {
    if (!dados) return;
    if (dados.vigenciaInicio) setVigenciaInicio(dados.vigenciaInicio);
    if (dados.vigenciaInicio && dados.vigenciaFim) {
      const det = detectarPrazoVigencia(dados.vigenciaInicio, dados.vigenciaFim);
      if (det) {
        setPrazoVigenciaQtd(det.qtd);
        setPrazoVigenciaUnidade(det.unidade);
      }
    }
  }, [dados]);

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
    if (res.arquivoUrl) setArquivoPdfUrl(res.arquivoUrl);
    if (res.nomeArquivo) setArquivoPdfNome(res.nomeArquivo);
    // Marca cada campo não-vazio do retorno da IA como "Auto"
    const auto = new Set<string>();
    const d = res.dados as Record<string, unknown>;
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) auto.add(k);
    }
    setCamposAuto(auto);
  }

  const formKey = dados ? `auto-${pdfNome}` : "manual";

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <Link
        href="/contratacoes/nova"
        className="inline-flex items-center gap-1 text-sm transition"
        style={{ color: "var(--text-mute)" }}
      >
        <ChevronLeft className="h-4 w-4" /> Voltar
      </Link>

      {/* Header */}
      <header className="glass mt-4 rounded-[28px] px-9 py-7">
        <div className="relative z-[1]">
          <p
            className="text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--primary)" }}
          >
            {modo === "editar" ? "Editar registro · Ata de Registro de Preços" : "Nova contratação · Ata de Registro de Preços"}
          </p>
          <h1
            className="mt-2 text-[40px] font-extrabold leading-none"
            style={{ color: "var(--text)", letterSpacing: "-0.045em" }}
          >
            {modo === "editar" ? "Corrigir " : "Cadastre sua "}
            <em
              style={{
                fontStyle: "normal",
                background: "linear-gradient(135deg, var(--primary-bright), var(--primary))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {modo === "editar" ? `Ata ${vi?.numero ?? ""}` : "Ata"}
            </em>
          </h1>
          <p
            className="mt-3 max-w-[640px] text-[14px]"
            style={{ color: "var(--text-mute)", letterSpacing: "-0.005em" }}
          >
            {modo === "editar"
              ? "Ajuste qualquer campo. Alterações em valores monetários, vigências e CNPJs pedem confirmação. Tudo fica registrado no histórico."
              : "Os itens registram preço e quantidade. O saldo é abatido automaticamente conforme você gera Contratos e Empenhos."}
          </p>
        </div>
      </header>

      {/* Upload PDF — IA extrai automático (escondido em modo edição) */}
      {modo !== "editar" && (
      <section
        className="glass-tile mt-5 overflow-hidden rounded-[20px] px-7 py-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(197,180,255,0.12), rgba(184,197,214,0.04)), var(--glass-2)",
        }}
      >
        <div className="relative z-[1] flex items-start gap-4">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, var(--lavender), var(--sky))",
              boxShadow: "0 4px 16px rgba(197,180,255,0.4)",
            }}
          >
            <Sparkles className="h-5 w-5" style={{ color: "#0A0A0A" }} />
          </div>
          <div className="flex-1">
            <h2
              className="text-[18px] font-extrabold"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              Preencher automaticamente a partir do PDF
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
              Anexe o PDF original. A IA extrai número, processo, órgão, vigência, prazos e itens.
              Você confere e edita antes de salvar.
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
                className="btn-primary inline-flex"
              >
                {extraindo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Extraindo dados…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {pdfNome ? "Outro PDF" : "Anexar PDF da Ata"}
                  </>
                )}
              </button>
              {pdfNome && !extraindo && (
                <span className="truncate max-w-md text-xs" style={{ color: "var(--text-mute)" }}>
                  {pdfNome}
                </span>
              )}
              {dados && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: "rgba(93,216,182,0.18)",
                    color: "var(--mint)",
                    border: "0.5px solid rgba(93,216,182,0.3)",
                  }}
                >
                  <Check className="h-3 w-3" /> {dados.itens.length} item(ns) preenchidos
                </span>
              )}
            </div>
            {extracaoErro && (
              <div
                className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
                style={{
                  background: "rgba(232,138,152,0.10)",
                  border: "0.5px solid rgba(232,138,152,0.3)",
                  color: "var(--coral)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{extracaoErro}</span>
              </div>
            )}
          </div>
        </div>
      </section>
      )}

      <form
        key={formKey}
        action={formAction}
        className="mt-6 space-y-5"
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
        {modo === "editar" && ataId && (
          <input type="hidden" name="ataId" value={ataId} />
        )}
        {/* PDF persistido pela IA — vira Anexo da Ata após save */}
        {arquivoPdfUrl && (
          <>
            <input type="hidden" name="arquivoPdfUrl" value={arquivoPdfUrl} />
            <input type="hidden" name="arquivoPdfNome" value={arquivoPdfNome ?? ""} />
          </>
        )}
        {/* Resumo de erros — clicável, scroll-into-view + focus */}
        {(state?.erro || errosResumo.length > 0) && (
          <div
            ref={resumoRef}
            className="rounded-[16px] px-5 py-4 text-sm"
            style={{
              background: "rgba(232,138,152,0.18)",
              border: "0.5px solid rgba(198,103,112,0.5)",
              color: "var(--coral-deep)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-extrabold">{state?.erro ?? "Verifique os campos abaixo:"}</p>
                {errosResumo.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {errosResumo.map(([campo, msg]) => (
                      <li key={campo}>
                        <button
                          type="button"
                          onClick={() => {
                            const sel = campo.includes(".") ? campo.split(".")[0] : campo;
                            const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${sel}"]`);
                            el?.focus();
                            el?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="text-left underline hover:opacity-80"
                        >
                          <strong>{rotularErro(campo)}</strong>: {msg}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === 2.1 IDENTIFICAÇÃO === */}
        <SecaoGlass
          numero="01"
          titulo="Identificação"
          subtitulo="Dados básicos da Ata — apenas o essencial."
          icone={FileText}
        >
          <div className="grid grid-cols-4 gap-4">
            <SelectGlass
              label="Empresa"
              name="empresaId"
              options={empresas}
              required
              erro={e.empresaId}
              span={2}
              defaultValue={(v.empresaId as string) ?? vi?.empresaId ?? empresaPreSelecionada}
            />
            <FieldGlass
              label="Número da Ata"
              name="numero"
              auto={camposAuto.has("numero")}
              placeholder="42/2026"
              required
              erro={e.numero}
              span={1}
              defaultValue={(v.numero as string) ?? dados?.numero ?? vi?.numero}
            />
            <FieldGlass
              label="Processo administrativo"
              name="processoAdministrativo"
              auto={camposAuto.has("processoAdministrativo")}
              required
              erro={e.processoAdministrativo}
              span={1}
              defaultValue={(v.processoAdministrativo as string) ?? dados?.processoAdministrativo ?? vi?.processoAdministrativo}
            />
            <SelectGlass
              label="Tipo de objeto"
              name="tipo"
              options={OPCOES_TIPO}
              required
              erro={e.tipo}
              span={2}
              defaultValue={(v.tipo as string) ?? vi?.tipo}
            />
            <SelectGlass
              label="Procedimento de seleção"
              name="procedimentoSelecao"
              options={OPCOES_PROCEDIMENTO}
              required
              erro={e.procedimentoSelecao}
              span={1}
              defaultValue={dados?.procedimentoSelecao ?? vi?.procedimentoSelecao}
            />
            <FieldGlass
              label="Nº do Pregão Eletrônico"
              name="numeroLicitacao"
              auto={camposAuto.has("numeroLicitacao")}
              placeholder="123/2025"
              erro={e.numeroLicitacao}
              span={1}
              defaultValue={dados?.numeroLicitacao ?? vi?.numeroLicitacao ?? ""}
            />
            <FieldGlass
              label="ID Ata no PNCP"
              name="idAtaPncp"
              helper="Opcional — preencha se já estiver publicado no PNCP"
              erro={e.idAtaPncp}
              span={2}
              defaultValue={dados?.idAtaPncp ?? vi?.idAtaPncp ?? ""}
            />
            <TextareaGlass
              label="Objeto (descrição geral)"
              name="objeto"
              auto={camposAuto.has("objeto")}
              required
              erro={e.objeto}
              span={4}
              minRows={3}
              defaultValue={(v.objeto as string) ?? dados?.objeto ?? vi?.objeto}
              placeholder="Descreva o objeto da contratação por completo — bens, serviços, especificações técnicas, condições."
            />
          </div>
        </SecaoGlass>

        {/* === 2.2 ÓRGÃO GERENCIADOR === */}
        <SecaoGlass
          numero="02"
          titulo="Órgão gerenciador"
          subtitulo="Órgão que gerencia a Ata. CNPJ é formatado automaticamente."
          icone={Building2}
        >
          <div className="grid grid-cols-4 gap-4">
            <FieldGlass
              label="Nome do órgão"
              name="orgaoNome"
              auto={camposAuto.has("orgaoNome")}
              required
              erro={e.orgaoNome}
              span={2}
              defaultValue={dados?.orgaoNome ?? vi?.orgaoNome}
            />
            <CnpjInput
              label="CNPJ do órgão"
              name="orgaoCnpj"
              auto={camposAuto.has("orgaoCnpj")}
              required
              erro={e.orgaoCnpj}
              span={2}
              defaultValue={dados?.orgaoCnpj ?? vi?.orgaoCnpj}
            />
            <CepInput
              label="CEP do órgão"
              name="orgaoCep"
              span={1}
              onResolve={(d) => {
                const enderecoBase = `${d.logradouro}, ${d.bairro}, ${d.cidade}/${d.uf}`;
                setOrgaoEndereco(enderecoBase);
              }}
            />
            <FieldGlass
              label="Endereço"
              name="orgaoEndereco"
              required
              erro={e.orgaoEndereco}
              span={3}
              value={orgaoEndereco}
              onChange={setOrgaoEndereco}
              defaultValue={dados?.orgaoEndereco ?? vi?.orgaoEndereco}
            />
            <FieldGlass
              label="E-mail"
              name="orgaoEmail"
              type="email"
              erro={e.orgaoEmail}
              span={2}
              defaultValue={dados?.orgaoEmail ?? vi?.orgaoEmail ?? ""}
            />
            <FieldGlass
              label="Telefone"
              name="orgaoTelefone"
              erro={e.orgaoTelefone}
              span={2}
              defaultValue={dados?.orgaoTelefone ?? vi?.orgaoTelefone ?? ""}
            />
          </div>
        </SecaoGlass>

        {/* === 2.3 ÓRGÃOS PARTICIPANTES === */}
        <SecaoGlass
          numero="03"
          titulo="Órgãos participantes"
          subtitulo="Órgãos que aderiram formalmente à Ata desde a publicação."
          icone={Users}
        >
          <fieldset className="mb-4">
            <div className="flex items-center gap-6">
              <span
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                style={{ color: "var(--text-soft)" }}
              >
                <span>Esta Ata possui órgão(s) participante(s)?</span>
                <TooltipAjuda texto={AJUDA.tipoOrgaoAta} />
              </span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="temParticipantes"
                  checked={!temParticipantes}
                  onChange={() => setTemParticipantes(false)}
                />
                <span style={{ color: "var(--text-soft)" }}>Não</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="temParticipantes"
                  checked={temParticipantes}
                  onChange={() => setTemParticipantes(true)}
                />
                <span style={{ color: "var(--text-soft)" }}>Sim</span>
              </label>
            </div>
          </fieldset>

          {temParticipantes && <OrgaosParticipantesEditor iniciais={vi?.orgaosParticipantes} />}
        </SecaoGlass>

        {/* === 2.4 DATAS E PRAZOS === */}
        <SecaoGlass
          numero="04"
          titulo="Datas e prazos"
          subtitulo="Vigência, prazos e marco de reajuste."
          icone={Calendar}
        >
          <div className="grid grid-cols-4 gap-4">
            <FieldGlass
              label="Data de assinatura"
              name="dataAssinatura"
              auto={camposAuto.has("dataAssinatura")}
              type="date"
              required
              erro={e.dataAssinatura}
              span={1}
              defaultValue={dados?.dataAssinatura ?? vi?.dataAssinatura}
            />
            <FieldGlass
              label="Data de publicação"
              name="dataPublicacao"
              type="date"
              erro={e.dataPublicacao}
              span={1}
              defaultValue={dados?.dataPublicacao ?? vi?.dataPublicacao ?? ""}
            />
            <FieldGlass
              label="Vigência — início"
              name="vigenciaInicio"
              type="date"
              required
              erro={e.vigenciaInicio}
              span={1}
              value={vigenciaInicio || dados?.vigenciaInicio || ""}
              onChange={setVigenciaInicio}
              ajuda={AJUDA.vigenciaAta}
            />
            {/* Prazo de vigência: qtd + unidade. Sistema calcula Vigência fim. */}
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
                  value={prazoVigenciaQtd}
                  onChange={(ev) => setPrazoVigenciaQtd(Number(ev.target.value) || 0)}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                />
                <select
                  value={prazoVigenciaUnidade}
                  onChange={(ev) =>
                    setPrazoVigenciaUnidade(ev.target.value as "DIAS" | "MESES" | "ANOS")
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
                Sugestão para ARP: 1 ano (Lei 14.133/2021).
              </span>
            </div>
            {/* Fim calculado — readonly. O input visível é meramente decorativo;
                o valor é enviado pro server via input hidden abaixo. */}
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
              <input type="hidden" name="vigenciaFim" value={vigenciaFim} />
              {e.vigenciaFim && (
                <span className="mt-1 block text-[11px]" style={{ color: "var(--coral-deep)" }}>
                  {e.vigenciaFim}
                </span>
              )}
            </div>
            {vigenciaFimNoPassado && (
              <div
                className="col-span-2 flex items-start gap-2.5 rounded-[12px] px-4 py-3 text-sm"
                style={{
                  background: "rgba(212,175,55,0.18)",
                  border: "0.5px solid rgba(168,137,71,0.5)",
                  color: "var(--primary-deep)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-extrabold">Atenção: a vigência final está no passado.</p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
                    A Ata será cadastrada como <strong>vencida</strong> e não vai aparecer nos KPIs
                    "Atas vigentes" / "Valores contratados" do dashboard. Se a vigência ainda está
                    ativa, ajuste a data.
                  </p>
                </div>
              </div>
            )}

            {/* Prazo de entrega com toggle "não se aplica" */}
            <div className="col-span-2">
              <span
                className="mb-1.5 block text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                Prazo de entrega
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  name="prazoEntregaDias"
                  min="0"
                  placeholder="Quantidade"
                  disabled={prazoNaoAplica}
                  defaultValue={dados?.prazoEntregaDias?.toString() ?? vi?.prazoEntregaDias?.toString() ?? ""}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ opacity: prazoNaoAplica ? 0.5 : 1 }}
                />
                <select
                  name="prazoEntregaUnidade"
                  value={prazoEntregaUnidade}
                  onChange={(ev) => setPrazoEntregaUnidade(ev.target.value as "DIAS" | "MESES")}
                  disabled={prazoNaoAplica}
                  className="rounded-xl px-3 py-3 text-sm font-bold uppercase"
                  style={{
                    border: "0.5px solid var(--hairline)",
                    background: "rgba(255,255,255,0.7)",
                    color: "var(--text)",
                    letterSpacing: "0.06em",
                    opacity: prazoNaoAplica ? 0.5 : 1,
                  }}
                >
                  <option value="DIAS">Dias</option>
                  <option value="MESES">Meses</option>
                </select>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold uppercase"
                  style={{
                    background: prazoNaoAplica
                      ? "rgba(212,175,55,0.18)"
                      : "rgba(15,14,12,0.04)",
                    border: prazoNaoAplica
                      ? "0.5px solid rgba(168,137,71,0.5)"
                      : "0.5px solid var(--hairline)",
                    color: prazoNaoAplica ? "var(--primary-deep)" : "var(--text-mute)",
                    letterSpacing: "0.08em",
                  }}
                >
                  <input
                    type="checkbox"
                    name="prazoEntregaNaoAplica"
                    checked={prazoNaoAplica}
                    onChange={(ev) => setPrazoNaoAplica(ev.target.checked)}
                    value="on"
                    className="h-3.5 w-3.5"
                  />
                  Não se aplica
                </label>
              </div>
              <span className="mt-1 block text-[11px]" style={{ color: "var(--text-mute)" }}>
                Use &ldquo;Não se aplica&rdquo; em Atas de locação ou eventos com data fixa.
              </span>
            </div>

            <FieldGlass
              label="Prazo de pagamento (dias)"
              name="prazoPagamentoDias"
              type="number"
              defaultValue={dados?.prazoPagamentoDias?.toString() ?? vi?.prazoPagamentoDias?.toString() ?? ""}
              span={2}
            />

            {/* Marco de reajuste — seletor + data */}
            <div className="col-span-4">
              <span
                className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase"
                style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
              >
                <span>
                  Marco de reajuste
                  <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: "var(--text-mute)" }}>
                    · usado para calcular quando você terá direito ao reajuste de preços
                  </span>
                </span>
                <TooltipAjuda texto={AJUDA.marcoReajuste} />
              </span>
              <div className="grid grid-cols-2 gap-3">
                <select
                  name="marcoReajusteOrigem"
                  value={marcoOrigem}
                  onChange={(ev) => setMarcoOrigem(ev.target.value)}
                  className="rounded-xl px-4 py-3 text-sm font-medium"
                >
                  <option value="">— Origem —</option>
                  {OPCOES_MARCO_REAJUSTE.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  name="marcoOrcamentoEstimado"
                  defaultValue={vi?.marcoOrcamentoEstimado ?? ""}
                  disabled={marcoOrigem === "OMISSA" || marcoOrigem === ""}
                  className="rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ opacity: marcoOrigem === "OMISSA" || marcoOrigem === "" ? 0.5 : 1 }}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            {/* Carona */}
            <label
              className="col-span-4 flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm"
              style={{
                background: "rgba(212,175,55,0.08)",
                border: "0.5px solid rgba(212,175,55,0.25)",
              }}
            >
              <input
                type="checkbox"
                name="aceitaCarona"
                className="mt-0.5"
                defaultChecked={dados?.aceitaCarona ?? vi?.aceitaCarona ?? false}
              />
              <span style={{ color: "var(--text-soft)" }}>
                Esta Ata aceita adesão (carona) por outros órgãos.
                <br />
                <span className="text-xs" style={{ color: "var(--text-mute)" }}>
                  Lei 14.133/2021 art. 86 — limite de <strong style={{ color: "var(--primary-deep)" }}>50% por órgão</strong> e{" "}
                  <strong style={{ color: "var(--primary-deep)" }}>200% no total</strong>. Sistema monitora os limites automaticamente.
                </span>
              </span>
            </label>
          </div>
        </SecaoGlass>

        {/* === 2.5 ENDEREÇOS DE ENTREGA === */}
        <SecaoGlass
          numero="05"
          titulo="Endereços de entrega"
          subtitulo="Onde o órgão pode pedir entrega. CEP busca automaticamente."
          icone={MapPin}
        >
          <EnderecosEntregaEditor iniciais={vi?.enderecosEntrega} />
        </SecaoGlass>

        {/* === 2.6 PONTOS FOCAIS === */}
        <SecaoGlass
          numero="06"
          titulo="Pontos focais do órgão"
          subtitulo="Pessoas-chave para gestão e fiscalização (Lei 14.133, art. 117)."
          icone={Users}
        >
          <PontosFocaisEditor iniciais={vi?.pontosFocais} />
        </SecaoGlass>

        {/* === 2.7 ITENS REGISTRADOS === */}
        <SecaoGlass
          numero="07"
          titulo="Itens registrados"
          subtitulo="Agrupe os itens por lote. Valor unitário com máscara automática."
          icone={Package}
        >
          <ItensEditor itensIniciais={vi?.itens ?? dados?.itens} />
        </SecaoGlass>

        {state?.erro && (
          <div
            className="rounded-2xl px-5 py-4 text-sm"
            style={{
              background: "rgba(232,138,152,0.10)",
              border: "0.5px solid rgba(232,138,152,0.3)",
              color: "var(--coral)",
            }}
          >
            <strong>Erro ao cadastrar Ata:</strong> {state.erro}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <SubmitButton>{modo === "editar" ? "Salvar alterações" : "Cadastrar Ata"}</SubmitButton>
          <Link
            href={modo === "editar" && ataId ? `/atas/${ataId}` : "/contratacoes/nova"}
            className="btn-secondary inline-flex"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   Sub-editor: Endereços de entrega (com busca CEP)
   ============================================================ */
function EnderecosEntregaEditor({
  iniciais,
}: {
  iniciais?: { id: string; rotulo: string | null; endereco: string }[];
}) {
  const [enderecos, setEnderecos] = useState<
    { id: string; rotulo: string; endereco: string; cep: string }[]
  >(
    iniciais && iniciais.length > 0
      ? iniciais.map((e) => ({ id: e.id, rotulo: e.rotulo ?? "", endereco: e.endereco, cep: "" }))
      : [{ id: "", rotulo: "", endereco: "", cep: "" }],
  );

  const atualizar = (idx: number, patch: Partial<{ rotulo: string; endereco: string; cep: string }>) => {
    setEnderecos((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const adicionar = () =>
    setEnderecos((prev) => [...prev, { id: "", rotulo: "", endereco: "", cep: "" }]);
  const remover = (idx: number) =>
    setEnderecos((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  async function buscarCep(idx: number, cepFormatado: string) {
    const cep = cepFormatado.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data.erro) {
        const enderecoAtual = enderecos[idx]?.endereco ?? "";
        const enderecoNovo = `${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""}/${data.uf || ""}`;
        // Só preenche se ainda não foi mexido
        if (!enderecoAtual || enderecoAtual.length < 10) {
          atualizar(idx, { endereco: enderecoNovo });
        }
      }
    } catch {
      // silencioso
    }
  }

  return (
    <div className="space-y-3">
      {enderecos.map((e, idx) => (
        <div
          key={e.id || `novo-${idx}`}
          className="grid grid-cols-12 gap-2 rounded-2xl px-3 py-3"
          style={{
            background: "var(--glass-2)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          {e.id && (
            <input type="hidden" name={`enderecosEntrega[${idx}][id]`} value={e.id} />
          )}
          <input
            type="text"
            placeholder="Rótulo (ex: Almoxarifado central)"
            name={`enderecosEntrega[${idx}][rotulo]`}
            value={e.rotulo}
            onChange={(ev) => atualizar(idx, { rotulo: ev.currentTarget.value })}
            className="col-span-3 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="CEP"
            value={e.cep}
            onChange={(ev) => {
              const f = formatarCepInput(ev.target.value);
              atualizar(idx, { cep: f });
              if (f.replace(/\D/g, "").length === 8) buscarCep(idx, f);
            }}
            className="col-span-2 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Endereço completo (rua, nº, bairro, cidade/UF)"
            name={`enderecosEntrega[${idx}][endereco]`}
            value={e.endereco}
            onChange={(ev) => atualizar(idx, { endereco: ev.currentTarget.value })}
            className="col-span-6 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => remover(idx)}
            disabled={enderecos.length <= 1}
            className="col-span-1 grid place-items-center rounded-md disabled:opacity-30"
            style={{ color: "var(--text-mute)" }}
            title="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.8)",
          color: "var(--text-soft)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar endereço
      </button>
    </div>
  );
}

/* ============================================================
   Sub-editor: Pontos Focais (sem pré-designações fixas)
   ============================================================ */
function PontosFocaisEditor({
  iniciais,
}: {
  iniciais?: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    funcao: string;
    funcaoDescricao: string | null;
  }[];
}) {
  const [pessoas, setPessoas] = useState<
    {
      id: string;
      nome: string;
      email: string;
      telefone: string;
      funcao: string;
      funcaoDescricao: string;
    }[]
  >(
    iniciais && iniciais.length > 0
      ? iniciais.map((p) => ({
          id: p.id,
          nome: p.nome,
          email: p.email ?? "",
          telefone: p.telefone ?? "",
          funcao: p.funcao,
          funcaoDescricao: p.funcaoDescricao ?? "",
        }))
      : [{ id: "", nome: "", email: "", telefone: "", funcao: "", funcaoDescricao: "" }],
  );

  const atualizar = (idx: number, patch: Partial<(typeof pessoas)[0]>) => {
    setPessoas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const adicionar = () =>
    setPessoas((prev) => [
      ...prev,
      { id: "", nome: "", email: "", telefone: "", funcao: "", funcaoDescricao: "" },
    ]);
  const remover = (idx: number) =>
    setPessoas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  return (
    <div className="space-y-3">
      {pessoas.map((p, idx) => (
        <div
          key={p.id || `nova-${idx}`}
          className="rounded-2xl px-4 py-4"
          style={{
            background: "var(--glass-2)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          {p.id && (
            <input type="hidden" name={`pontosFocais[${idx}][id]`} value={p.id} />
          )}
          <div className="grid grid-cols-12 gap-3">
            <input
              type="text"
              name={`pontosFocais[${idx}][nome]`}
              placeholder="Nome"
              value={p.nome}
              onChange={(ev) => atualizar(idx, { nome: ev.target.value })}
              className="col-span-3 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="email"
              name={`pontosFocais[${idx}][email]`}
              placeholder="E-mail"
              value={p.email}
              onChange={(ev) => atualizar(idx, { email: ev.target.value })}
              className="col-span-3 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              name={`pontosFocais[${idx}][telefone]`}
              placeholder="Telefone"
              value={p.telefone}
              onChange={(ev) => atualizar(idx, { telefone: ev.target.value })}
              className="col-span-2 rounded-md px-3 py-2 text-sm"
            />
            <select
              name={`pontosFocais[${idx}][funcao]`}
              value={p.funcao}
              onChange={(ev) => atualizar(idx, { funcao: ev.target.value })}
              className="col-span-3 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Função —</option>
              {OPCOES_FUNCAO_PONTO_FOCAL.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remover(idx)}
              disabled={pessoas.length <= 1}
              className="col-span-1 grid place-items-center rounded-md disabled:opacity-30"
              style={{ color: "var(--text-mute)" }}
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {/* Quando função = OUTRO, mostra campo de descrição */}
          {p.funcao === "OUTRO" && (
            <div className="mt-3">
              <input
                type="text"
                name={`pontosFocais[${idx}][funcaoDescricao]`}
                placeholder="Especifique a função (ex: Coordenador técnico)"
                value={p.funcaoDescricao}
                onChange={(ev) => atualizar(idx, { funcaoDescricao: ev.target.value })}
                className="w-full rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.8)",
          color: "var(--text-soft)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar pessoa
      </button>
    </div>
  );
}

/* ============================================================
   Sub-editor: Órgãos Participantes (briefing 2.3)
   ============================================================ */
function OrgaosParticipantesEditor({
  iniciais,
}: {
  iniciais?: {
    id: string;
    tipo: string;
    nome: string;
    cnpj: string;
    endereco: string;
    email: string | null;
    telefone: string | null;
  }[];
}) {
  const [orgaos, setOrgaos] = useState<
    { id: string; tipo: string; nome: string; cnpj: string; endereco: string; cep: string; email: string; telefone: string }[]
  >(
    iniciais && iniciais.length > 0
      ? iniciais.map((o) => ({
          id: o.id,
          tipo: o.tipo,
          nome: o.nome,
          cnpj: formatarCnpjInput(o.cnpj),
          endereco: o.endereco,
          cep: "",
          email: o.email ?? "",
          telefone: o.telefone ?? "",
        }))
      : [{ id: "", tipo: "PARTICIPANTE", nome: "", cnpj: "", endereco: "", cep: "", email: "", telefone: "" }],
  );

  const atualizar = (idx: number, patch: Partial<(typeof orgaos)[0]>) => {
    setOrgaos((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };
  const adicionar = () =>
    setOrgaos((prev) => [
      ...prev,
      { id: "", tipo: "PARTICIPANTE", nome: "", cnpj: "", endereco: "", cep: "", email: "", telefone: "" },
    ]);
  const remover = (idx: number) =>
    setOrgaos((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  async function buscarCep(idx: number, cepFormatado: string) {
    const cep = cepFormatado.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data.erro) {
        atualizar(idx, {
          endereco: `${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""}/${data.uf || ""}`,
        });
      }
    } catch {
      // silencioso
    }
  }

  return (
    <div className="space-y-3">
      {orgaos.map((o, idx) => (
        <div
          key={o.id || `novo-${idx}`}
          className="rounded-2xl px-4 py-4"
          style={{
            background: "var(--glass-2)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span
              className="text-[10px] font-bold uppercase"
              style={{ letterSpacing: "0.18em", color: "var(--primary)" }}
            >
              Órgão {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => remover(idx)}
              disabled={orgaos.length <= 1}
              className="rounded-md p-1.5 disabled:opacity-30"
              style={{ color: "var(--text-mute)" }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {o.id && (
            <input type="hidden" name={`orgaosParticipantes[${idx}][id]`} value={o.id} />
          )}
          <input type="hidden" name={`orgaosParticipantes[${idx}][tipo]`} value={o.tipo} />
          <div className="grid grid-cols-12 gap-3">
            <input
              type="text"
              name={`orgaosParticipantes[${idx}][nome]`}
              placeholder="Nome do órgão"
              value={o.nome}
              onChange={(ev) => atualizar(idx, { nome: ev.target.value })}
              className="col-span-7 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              name={`orgaosParticipantes[${idx}][cnpj]`}
              placeholder="00.000.000/0000-00"
              value={o.cnpj}
              onChange={(ev) => atualizar(idx, { cnpj: formatarCnpjInput(ev.target.value) })}
              className="col-span-5 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="CEP"
              value={o.cep}
              onChange={(ev) => {
                const f = formatarCepInput(ev.target.value);
                atualizar(idx, { cep: f });
                if (f.replace(/\D/g, "").length === 8) buscarCep(idx, f);
              }}
              className="col-span-2 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              name={`orgaosParticipantes[${idx}][endereco]`}
              placeholder="Endereço completo"
              value={o.endereco}
              onChange={(ev) => atualizar(idx, { endereco: ev.target.value })}
              className="col-span-10 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="email"
              name={`orgaosParticipantes[${idx}][email]`}
              placeholder="E-mail"
              value={o.email}
              onChange={(ev) => atualizar(idx, { email: ev.target.value })}
              className="col-span-7 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              name={`orgaosParticipantes[${idx}][telefone]`}
              placeholder="Telefone"
              value={o.telefone}
              onChange={(ev) => atualizar(idx, { telefone: ev.target.value })}
              className="col-span-5 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
        style={{
          background: "rgba(212, 175, 55, 0.14)",
          color: "var(--primary-deep)",
          border: "0.5px solid rgba(212, 175, 55, 0.3)",
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar órgão participante
      </button>
    </div>
  );
}
