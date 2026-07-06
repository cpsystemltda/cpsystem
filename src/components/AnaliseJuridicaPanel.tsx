"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles,
  FileText,
  ClipboardList,
  Truck,
  AlertCircle,
  CheckCircle,
  Clock,
  Scale,
  Loader2,
  History,
  RotateCw,
  Upload,
  GitCompareArrows,
  Download,
  Handshake,
  FileType2,
} from "lucide-react";
import {
  analisarDocumentoJuridicoAction,
  listarPareceresAction,
  lerParecerAction,
  uploadDocumentoAvulsoAction,
  analisarAvulsoAction,
  compararAvulsosAction,
  type AnalisarDocumentoResult,
  type CompararResult,
  type ParecerListItem,
} from "@/app/actions/iaJuridica";
import type { AnaliseJuridica, ComparacaoJuridica, TipoDocJuridico } from "@/lib/iaJuridica";
import { ParecerPdfDoc, ComparacaoPdfDoc } from "./ParecerPdfDoc";

// Carregamento dinâmico do PDFDownloadLink — evita bundle do react-pdf
// no server e reduz first-load. Só é ativado quando usuário clica em exportar.
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <span className="text-xs text-slate-500">Preparando PDF…</span> },
);

type OpcaoSistema = { id: string; rotulo: string };
type OpcaoAvulso = { id: string; rotulo: string; pdfUrl: string; tipo: string };
type Modo = "SISTEMA" | "AVULSO" | "COMPARAR";

const TIPOS_SISTEMA: { value: Exclude<TipoDocJuridico, "TERMO_COOPERACAO" | "AVULSO">; label: string; icone: React.ComponentType<{ className?: string }>; }[] = [
  { value: "ATA", label: "Ata de Registro de Preços", icone: FileText },
  { value: "CONTRATO", label: "Contrato administrativo", icone: ClipboardList },
  { value: "EMPENHO", label: "Empenho / Instrumento art. 95", icone: Truck },
];

const TIPOS_AVULSO: { value: string; label: string; icone: React.ComponentType<{ className?: string }> }[] = [
  { value: "TERMO_COOPERACAO", label: "Termo de Cooperação", icone: Handshake },
  { value: "MINUTA", label: "Minuta / Pré-contrato", icone: FileType2 },
  { value: "ADITIVO", label: "Aditivo", icone: FileText },
  { value: "OUTRO", label: "Outro documento", icone: FileType2 },
];

const COR_SEVERIDADE: Record<"alta" | "media" | "baixa", { bg: string; border: string; fg: string }> = {
  alta: { bg: "bg-red-50", border: "border-red-300", fg: "text-red-800" },
  media: { bg: "bg-amber-50", border: "border-amber-300", fg: "text-amber-800" },
  baixa: { bg: "bg-blue-50", border: "border-blue-300", fg: "text-blue-800" },
};

export function AnaliseJuridicaPanel({
  atas,
  contratos,
  empenhos,
  avulsos: avulsosIniciais,
}: {
  atas: OpcaoSistema[];
  contratos: OpcaoSistema[];
  empenhos: OpcaoSistema[];
  avulsos: OpcaoAvulso[];
}) {
  const [modo, setModo] = useState<Modo>("SISTEMA");
  const [avulsos, setAvulsos] = useState<OpcaoAvulso[]>(avulsosIniciais);

  return (
    <div className="space-y-5">
      {/* Selector de modo */}
      <div className="grid gap-2 md:grid-cols-3">
        <BotaoModo ativo={modo === "SISTEMA"} onClick={() => setModo("SISTEMA")} icone={FileText} rotulo="Do sistema" />
        <BotaoModo ativo={modo === "AVULSO"} onClick={() => setModo("AVULSO")} icone={Upload} rotulo="Upload PDF (TC, minuta…)" />
        <BotaoModo ativo={modo === "COMPARAR"} onClick={() => setModo("COMPARAR")} icone={GitCompareArrows} rotulo="Comparar 2 documentos" />
      </div>

      {modo === "SISTEMA" && <ModoSistema atas={atas} contratos={contratos} empenhos={empenhos} />}
      {modo === "AVULSO" && (
        <ModoAvulso
          avulsos={avulsos}
          onNovoUpload={(a) => setAvulsos((prev) => [a, ...prev])}
        />
      )}
      {modo === "COMPARAR" && <ModoComparar avulsos={avulsos} />}
    </div>
  );
}

function BotaoModo({
  ativo,
  onClick,
  icone: Icone,
  rotulo,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
        ativo
          ? "border-violet-500 bg-violet-50 text-violet-900"
          : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
      }`}
    >
      <Icone className={`h-4 w-4 shrink-0 ${ativo ? "text-violet-600" : "text-slate-500"}`} />
      {rotulo}
    </button>
  );
}

// ============================================================
// MODO SISTEMA — Ata / Contrato / Empenho existentes
// ============================================================
function ModoSistema({
  atas,
  contratos,
  empenhos,
}: {
  atas: OpcaoSistema[];
  contratos: OpcaoSistema[];
  empenhos: OpcaoSistema[];
}) {
  const [tipo, setTipo] = useState<Exclude<TipoDocJuridico, "TERMO_COOPERACAO" | "AVULSO">>("CONTRATO");
  const [documentoId, setDocumentoId] = useState("");
  const [resultado, setResultado] = useState<AnalisarDocumentoResult | null>(null);
  const [parecerSelecionadoId, setParecerSelecionadoId] = useState<string | null>(null);
  const [pareceres, setPareceres] = useState<ParecerListItem[]>([]);
  const [carregandoHistorico, startCarregarHistorico] = useTransition();
  const [analisando, startTransition] = useTransition();
  const [carregandoParecer, startCarregarParecer] = useTransition();

  const opcoes = useMemo(() => {
    if (tipo === "ATA") return atas;
    if (tipo === "CONTRATO") return contratos;
    return empenhos;
  }, [tipo, atas, contratos, empenhos]);

  const nomeDoc = useMemo(() => {
    const o = opcoes.find((x) => x.id === documentoId);
    return o?.rotulo ?? "documento";
  }, [documentoId, opcoes]);

  useEffect(() => {
    if (!documentoId) {
      setPareceres([]);
      setResultado(null);
      setParecerSelecionadoId(null);
      return;
    }
    startCarregarHistorico(async () => {
      const lista = await listarPareceresAction(tipo, documentoId);
      setPareceres(lista);
      if (lista.length > 0) {
        const maisRecente = lista[0];
        setParecerSelecionadoId(maisRecente.id);
        const r = await lerParecerAction(maisRecente.id);
        if (r.ok) {
          setResultado({ ok: true, analise: r.analise, demo: r.demo });
        } else {
          setResultado(null);
        }
      } else {
        setParecerSelecionadoId(null);
        setResultado(null);
      }
    });
  }, [tipo, documentoId]);

  function selecionarParecer(parecerId: string) {
    setParecerSelecionadoId(parecerId);
    startCarregarParecer(async () => {
      const r = await lerParecerAction(parecerId);
      if (r.ok) {
        setResultado({ ok: true, analise: r.analise, demo: r.demo });
      } else {
        setResultado({ ok: false, erro: r.erro });
      }
    });
  }

  function analisar() {
    if (!documentoId) return;
    startTransition(async () => {
      const r = await analisarDocumentoJuridicoAction(tipo, documentoId);
      setResultado(r);
      const lista = await listarPareceresAction(tipo, documentoId);
      setPareceres(lista);
      if (lista.length > 0) setParecerSelecionadoId(lista[0].id);
    });
  }

  return (
    <>
      <div className="glass rounded-2xl px-6 py-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-600" /> Analisar documento do sistema
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          IA analisa Ata/Contrato/Empenho já cadastrado. Parecer estruturado em segundos.
        </p>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {TIPOS_SISTEMA.map((t) => {
            const ativo = tipo === t.value;
            const Icone = t.icone;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTipo(t.value);
                  setDocumentoId("");
                  setResultado(null);
                }}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                  ativo
                    ? "border-violet-500 bg-violet-50 text-violet-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                }`}
              >
                <Icone className={`h-4 w-4 shrink-0 ${ativo ? "text-violet-600" : "text-slate-500"}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={documentoId}
            onChange={(ev) => setDocumentoId(ev.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="">— Escolha o documento —</option>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={analisar}
            disabled={!documentoId || analisando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
          >
            {analisando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando…
              </>
            ) : pareceres.length > 0 ? (
              <>
                <RotateCw className="h-4 w-4" /> Re-analisar
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Analisar com IA
              </>
            )}
          </button>
        </div>

        {opcoes.length === 0 && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nenhum documento desse tipo cadastrado ainda. Cadastre primeiro em Atas / Contratos / Fornecimento.
          </p>
        )}

        {documentoId && pareceres.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              <History className="h-3.5 w-3.5" /> Histórico ({pareceres.length})
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pareceres.map((p, i) => {
                const sel = parecerSelecionadoId === p.id;
                const eMaisRecente = i === 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selecionarParecer(p.id)}
                    disabled={carregandoParecer && sel}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50"
                    style={{
                      background: sel ? "var(--primary-deep, #4338ca)" : "white",
                      color: sel ? "white" : "var(--text)",
                      border: sel ? "1px solid var(--primary-deep, #4338ca)" : "1px solid var(--hairline, #e2e8f0)",
                    }}
                  >
                    {formatarDataHora(p.criadoEm)}
                    {eMaisRecente && <span className="text-[9px] opacity-80">(atual)</span>}
                    {p.demo && (
                      <span
                        className="rounded-full px-1.5 py-0 text-[8px] uppercase"
                        style={{ background: "rgba(212,175,55,0.25)", color: sel ? "white" : "#92400e" }}
                      >
                        demo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(carregandoHistorico || carregandoParecer) && !analisando && (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
          </p>
        )}
      </div>

      {resultado && resultado.ok && <ResultadoAnalise analise={resultado.analise} nomeDoc={nomeDoc} />}
      {resultado && !resultado.ok && <ErroBox mensagem={resultado.erro} />}
    </>
  );
}

// ============================================================
// MODO AVULSO — Upload PDF + análise
// ============================================================
function ModoAvulso({
  avulsos,
  onNovoUpload,
}: {
  avulsos: OpcaoAvulso[];
  onNovoUpload: (a: OpcaoAvulso) => void;
}) {
  const [tipo, setTipo] = useState("TERMO_COOPERACAO");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [avulsoSelecionadoId, setAvulsoSelecionadoId] = useState("");
  const [uploadErro, setUploadErro] = useState<string | null>(null);
  const [subindo, startSubir] = useTransition();
  const [analisando, startAnalisar] = useTransition();
  const [resultado, setResultado] = useState<AnalisarDocumentoResult | null>(null);

  const nomeDoc = useMemo(() => {
    const a = avulsos.find((x) => x.id === avulsoSelecionadoId);
    return a?.rotulo ?? "documento";
  }, [avulsoSelecionadoId, avulsos]);

  function submeter(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setUploadErro(null);
    if (!arquivo) return setUploadErro("Escolha um arquivo PDF.");
    startSubir(async () => {
      const fd = new FormData();
      fd.set("arquivo", arquivo);
      fd.set("tipo", tipo);
      const r = await uploadDocumentoAvulsoAction(fd);
      if (!r.ok) return setUploadErro(r.erro);
      const novo: OpcaoAvulso = {
        id: r.id,
        rotulo: `${r.tipo === "TERMO_COOPERACAO" ? "Termo de Cooperação" : r.tipo === "MINUTA" ? "Minuta" : r.tipo === "ADITIVO" ? "Aditivo" : "Documento avulso"} · ${r.nome}`,
        pdfUrl: r.pdfUrl,
        tipo: r.tipo,
      };
      onNovoUpload(novo);
      setAvulsoSelecionadoId(novo.id);
      setArquivo(null);
      const input = document.getElementById("avulso-file-input") as HTMLInputElement | null;
      if (input) input.value = "";
    });
  }

  function analisar() {
    if (!avulsoSelecionadoId) return;
    startAnalisar(async () => {
      const r = await analisarAvulsoAction(avulsoSelecionadoId);
      setResultado(r);
    });
  }

  return (
    <>
      <div className="glass rounded-2xl px-6 py-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <Upload className="h-4 w-4 text-violet-600" /> Upload de PDF pra análise
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Envie um Termo de Cooperação, minuta, aditivo ou qualquer PDF de documento
          administrativo. A IA lê o PDF direto e gera parecer estruturado.
        </p>

        <form onSubmit={submeter} className="mt-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            {TIPOS_AVULSO.map((t) => {
              const ativo = tipo === t.value;
              const Icone = t.icone;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition ${
                    ativo
                      ? "border-violet-500 bg-violet-50 text-violet-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                  }`}
                >
                  <Icone className={`h-3.5 w-3.5 shrink-0 ${ativo ? "text-violet-600" : "text-slate-500"}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              id="avulso-file-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-700"
            />
            <button
              type="submit"
              disabled={!arquivo || subindo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
            >
              {subindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Enviar PDF
                </>
              )}
            </button>
          </div>

          {uploadErro && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertCircle className="mr-1 inline-block h-3.5 w-3.5" /> {uploadErro}
            </p>
          )}
        </form>
      </div>

      {avulsos.length > 0 && (
        <div className="glass rounded-2xl px-6 py-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Analisar documento avulso já enviado
          </h4>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={avulsoSelecionadoId}
              onChange={(e) => {
                setAvulsoSelecionadoId(e.target.value);
                setResultado(null);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              <option value="">— Escolha um documento —</option>
              {avulsos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.rotulo}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={analisar}
              disabled={!avulsoSelecionadoId || analisando}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
            >
              {analisando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando PDF…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Analisar com IA
                </>
              )}
            </button>
          </div>
          {avulsoSelecionadoId && (
            <a
              href={avulsos.find((a) => a.id === avulsoSelecionadoId)?.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-violet-700 underline"
            >
              Ver PDF original
            </a>
          )}
        </div>
      )}

      {resultado && resultado.ok && <ResultadoAnalise analise={resultado.analise} nomeDoc={nomeDoc} />}
      {resultado && !resultado.ok && <ErroBox mensagem={resultado.erro} />}
    </>
  );
}

// ============================================================
// MODO COMPARAR — 2 avulsos comparados
// ============================================================
function ModoComparar({ avulsos }: { avulsos: OpcaoAvulso[] }) {
  const [idOriginal, setIdOriginal] = useState("");
  const [idAlterado, setIdAlterado] = useState("");
  const [resultado, setResultado] = useState<CompararResult | null>(null);
  const [comparando, startComparar] = useTransition();

  const nomeOriginal = avulsos.find((a) => a.id === idOriginal)?.rotulo ?? "original";
  const nomeAlterado = avulsos.find((a) => a.id === idAlterado)?.rotulo ?? "alterado";

  function comparar() {
    if (!idOriginal || !idAlterado) return;
    startComparar(async () => {
      const r = await compararAvulsosAction(idOriginal, idAlterado);
      setResultado(r);
    });
  }

  if (avulsos.length < 2) {
    return (
      <div className="glass rounded-2xl px-6 py-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <GitCompareArrows className="h-4 w-4 text-violet-600" /> Comparar 2 documentos
        </h3>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Você precisa ter <strong>pelo menos 2 documentos avulsos</strong> enviados pra comparar.
          Suba os PDFs na aba <em>Upload PDF</em> primeiro.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-2xl px-6 py-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <GitCompareArrows className="h-4 w-4 text-violet-600" /> Comparar 2 documentos
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Ex: minuta enviada pelo órgão vs. contrato assinado, ou versão original vs. aditivo.
          A IA aponta as diferenças com impacto jurídico e recomenda ação.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Documento original</label>
            <select
              value={idOriginal}
              onChange={(e) => {
                setIdOriginal(e.target.value);
                setResultado(null);
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            >
              <option value="">— Escolha —</option>
              {avulsos.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === idAlterado}>
                  {a.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Documento alterado</label>
            <select
              value={idAlterado}
              onChange={(e) => {
                setIdAlterado(e.target.value);
                setResultado(null);
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            >
              <option value="">— Escolha —</option>
              {avulsos.map((a) => (
                <option key={a.id} value={a.id} disabled={a.id === idOriginal}>
                  {a.rotulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={comparar}
          disabled={!idOriginal || !idAlterado || comparando}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
        >
          {comparando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Comparando PDFs…
            </>
          ) : (
            <>
              <GitCompareArrows className="h-4 w-4" /> Comparar com IA
            </>
          )}
        </button>
      </div>

      {resultado && resultado.ok && (
        <ResultadoComparacao
          comparacao={resultado.comparacao}
          nomeOriginal={nomeOriginal}
          nomeAlterado={nomeAlterado}
        />
      )}
      {resultado && !resultado.ok && <ErroBox mensagem={resultado.erro} />}
    </>
  );
}

// ============================================================
// COMPONENTES DE RESULTADO
// ============================================================
function formatarDataHora(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ErroBox({ mensagem }: { mensagem: string }) {
  return (
    <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="mr-1 inline-block h-4 w-4" /> {mensagem}
    </div>
  );
}

function ResultadoAnalise({ analise, nomeDoc }: { analise: AnaliseJuridica; nomeDoc: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <PDFDownloadLink
          document={<ParecerPdfDoc analise={analise} documentoNome={nomeDoc} />}
          fileName={`parecer-${nomeDoc.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60)}.pdf`}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100"
        >
          <Download className="h-3.5 w-3.5" /> Exportar parecer em PDF
        </PDFDownloadLink>
      </div>

      {/* Resumo executivo */}
      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "linear-gradient(135deg, rgba(142, 115, 224, 0.10), rgba(107, 79, 201, 0.04))",
          border: "0.5px solid rgba(142, 115, 224, 0.30)",
        }}
      >
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
          <Scale className="h-3.5 w-3.5" /> Resumo executivo
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{analise.resumoExecutivo}</p>
      </div>

      {/* Pontos críticos */}
      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Pontos críticos ({analise.pontosCriticos.length})
        </h4>
        <ul className="mt-3 space-y-2">
          {analise.pontosCriticos.map((p, i) => {
            const c = COR_SEVERIDADE[p.severidade];
            return (
              <li key={i} className={`rounded-xl border ${c.border} ${c.bg} px-3 py-2`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${c.fg}`}>{p.titulo}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.fg}`}
                    style={{ background: "rgba(255,255,255,0.6)" }}
                  >
                    {p.severidade}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-700">{p.descricao}</p>
              </li>
            );
          })}
          {analise.pontosCriticos.length === 0 && (
            <li className="text-xs text-slate-500">Nenhum ponto crítico identificado.</li>
          )}
        </ul>
      </div>

      {/* Checklist */}
      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Checklist de gestão ({analise.checklistGestao.length})
        </h4>
        <ul className="mt-3 space-y-1.5">
          {analise.checklistGestao.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <CheckCircle
                className={`mt-0.5 h-4 w-4 shrink-0 ${c.concluido ? "text-emerald-600" : "text-slate-300"}`}
              />
              <span className={c.concluido ? "line-through text-slate-500" : ""}>{c.item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Janelas críticas */}
      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <Clock className="h-3.5 w-3.5 text-amber-600" /> Janelas críticas de prazo ({analise.janelasCriticas.length})
        </h4>
        <ul className="mt-3 space-y-2">
          {analise.janelasCriticas.map((j, i) => (
            <li key={i} className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-amber-900">{j.evento}</span>
                <span className="text-xs font-semibold text-amber-700">{j.prazo}</span>
              </div>
              <p className="mt-1 text-xs text-amber-800">{j.recomendacao}</p>
            </li>
          ))}
          {analise.janelasCriticas.length === 0 && (
            <li className="text-xs text-slate-500">Nenhuma janela de prazo destacada.</li>
          )}
        </ul>
      </div>

      <p className="text-[11px] text-slate-500">
        Parecer gerado por IA. Decisões críticas devem ser confirmadas com advogado da empresa.
      </p>
    </div>
  );
}

function ResultadoComparacao({
  comparacao,
  nomeOriginal,
  nomeAlterado,
}: {
  comparacao: ComparacaoJuridica;
  nomeOriginal: string;
  nomeAlterado: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <PDFDownloadLink
          document={<ComparacaoPdfDoc comparacao={comparacao} nomeOriginal={nomeOriginal} nomeAlterado={nomeAlterado} />}
          fileName={`comparacao-${nomeOriginal.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30)}-vs-${nomeAlterado.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30)}.pdf`}
          className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800 hover:bg-violet-100"
        >
          <Download className="h-3.5 w-3.5" /> Exportar comparação em PDF
        </PDFDownloadLink>
      </div>

      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "linear-gradient(135deg, rgba(142, 115, 224, 0.10), rgba(107, 79, 201, 0.04))",
          border: "0.5px solid rgba(142, 115, 224, 0.30)",
        }}
      >
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700">
          <GitCompareArrows className="h-3.5 w-3.5" /> Resumo das diferenças
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{comparacao.resumoDiferencas}</p>
      </div>

      <div className="glass rounded-2xl px-5 py-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Diferenças críticas ({comparacao.diferencasCriticas.length})
        </h4>
        <ul className="mt-3 space-y-2">
          {comparacao.diferencasCriticas.map((d, i) => {
            const c = COR_SEVERIDADE[d.severidade];
            return (
              <li key={i} className={`rounded-xl border ${c.border} ${c.bg} px-3 py-2`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${c.fg}`}>{d.titulo}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.fg}`}
                    style={{ background: "rgba(255,255,255,0.6)" }}
                  >
                    {d.severidade}
                  </span>
                </div>
                <div className="mt-2 grid gap-1.5 md:grid-cols-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-600">Original:</p>
                    <p className="text-slate-700">{d.original}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-600">Alterado:</p>
                    <p className="text-slate-700">{d.alterado}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-700">
                  <strong>Impacto:</strong> {d.impacto}
                </p>
              </li>
            );
          })}
          {comparacao.diferencasCriticas.length === 0 && (
            <li className="text-xs text-slate-500">Nenhuma diferença crítica identificada.</li>
          )}
        </ul>
      </div>

      {comparacao.clausulasNovas.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Cláusulas novas ({comparacao.clausulasNovas.length})
          </h4>
          <ul className="mt-2 space-y-2">
            {comparacao.clausulasNovas.map((c, i) => (
              <li key={i} className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm">
                <p className="font-bold text-blue-900">{c.clausula}</p>
                <p className="mt-1 text-xs text-blue-800">
                  <strong>Risco:</strong> {c.risco}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {comparacao.clausulasRemovidas.length > 0 && (
        <div className="glass rounded-2xl px-5 py-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Cláusulas removidas ({comparacao.clausulasRemovidas.length})
          </h4>
          <ul className="mt-2 space-y-2">
            {comparacao.clausulasRemovidas.map((c, i) => (
              <li key={i} className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm">
                <p className="font-bold text-amber-900">{c.clausula}</p>
                <p className="mt-1 text-xs text-amber-800">
                  <strong>Consequência:</strong> {c.consequencia}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="rounded-2xl px-5 py-4"
        style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.10), rgba(184,134,11,0.05))",
          border: "0.5px solid rgba(212,175,55,0.35)",
        }}
      >
        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#92400E" }}>
          Recomendação
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-800">{comparacao.recomendacao}</p>
      </div>
    </div>
  );
}
