"use client";

/**
 * Card de Upload Inteligente — drop universal de PDF.
 *
 * Fluxo:
 *  1. Usuário anexa PDF (qualquer tipo)
 *  2. IA classifica (Ata / Contrato / Empenho / Aditivo / ...)
 *  3. Pra tipos com rota direta (Ata/Contrato/Empenho): extrai dados
 *     + redireciona pro form correspondente com prefill via sessionStorage.
 *  4. Pra tipos sem rota direta (Aditivo/Garantia/etc.): orienta o usuário
 *     a abrir a entidade pai e anexar lá.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Upload,
  Loader2,
  Check,
  AlertCircle,
  Beaker,
  ArrowRight,
  FileQuestion,
} from "lucide-react";
import {
  processarPdfIaAction,
  type ProcessarResult,
  type TipoDocumento,
} from "@/app/actions/iaClassificar";

const ROTULO_TIPO: Record<TipoDocumento, string> = {
  ATA: "Ata de Registro de Preços",
  CONTRATO: "Contrato administrativo",
  EMPENHO: "Nota de Empenho",
  ADITIVO: "Termo Aditivo",
  APOSTILAMENTO: "Termo de Apostilamento",
  GARANTIA: "Garantia contratual",
  NOTIFICACAO: "Notificação administrativa",
  PROCEDIMENTO: "Procedimento apuratório",
  DESCONHECIDO: "Documento não identificado",
};

const ORIENTACOES_MANUAL: Partial<Record<TipoDocumento, string>> = {
  ADITIVO: "Abra o contrato (ou ata) ao qual ele se refere e use a aba Aditivos para anexar.",
  APOSTILAMENTO: "Abra o contrato (ou ata) e use a aba Apostilamentos para anexar.",
  GARANTIA: "Abra o contrato (ou empenho) e use a aba Garantias para anexar.",
  NOTIFICACAO: "Abra o contrato (ou empenho) e use a aba Notificações para registrar.",
  PROCEDIMENTO: "Abra o contrato (ou empenho) e use a aba Procedimentos apuratórios.",
};

// Tipos com rota direta + label pra usuário escolher manualmente quando IA falha
const TIPOS_COM_ROTA: { tipo: TipoDocumento; rota: string; label: string }[] = [
  { tipo: "ATA", rota: "/contratacoes/nova/ata", label: "Ata" },
  { tipo: "CONTRATO", rota: "/contratacoes/nova/contrato", label: "Contrato" },
  { tipo: "EMPENHO", rota: "/contratacoes/nova/empenho", label: "Empenho" },
];

/**
 * Bloco mostrado quando IA tem confiança baixa (< 70%) ou não identificou
 * o tipo. Explica o motivo e oferece opções claras:
 *   - Continuar com a sugestão da IA
 *   - Escolher manualmente entre Ata / Contrato / Empenho
 *   - Tentar outro PDF
 */
function BaixaConfiancaBlock({
  tipoSugerido,
  rotaForm,
  onContinuar,
  motivo,
  onReset,
}: {
  tipoSugerido: TipoDocumento;
  rotaForm: string | null;
  onContinuar: (rota: string) => void;
  motivo: string;
  onReset?: () => void;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-4 space-y-3"
      style={{
        background: "rgba(212,175,55,0.06)",
        border: "0.5px solid rgba(212,175,55,0.25)",
      }}
    >
      <div>
        <p
          className="text-[12px] font-bold"
          style={{ color: "var(--primary-deep)", letterSpacing: "-0.005em" }}
        >
          Confirme o tipo antes de avançar
        </p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-soft)" }}>
          {motivo}. Você pode aceitar a sugestão ou escolher manualmente o formulário correto —
          o PDF já anexado será carregado automaticamente.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {rotaForm && tipoSugerido !== "DESCONHECIDO" && (
          <button
            type="button"
            onClick={() => onContinuar(rotaForm)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition hover:opacity-80"
            style={{
              background: "var(--primary)",
              color: "#0A0A0A",
            }}
          >
            Continuar como {ROTULO_TIPO[tipoSugerido]}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
        <span
          className="text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.12em", color: "var(--text-mute)" }}
        >
          {rotaForm && tipoSugerido !== "DESCONHECIDO" ? "ou criar manualmente:" : "Criar manualmente:"}
        </span>
        {TIPOS_COM_ROTA.filter((t) => t.tipo !== tipoSugerido).map((t) => (
          <button
            key={t.tipo}
            type="button"
            onClick={() => onContinuar(t.rota)}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
            style={{
              background: "var(--glass-2)",
              color: "var(--text)",
              border: "0.5px solid var(--border-soft)",
            }}
          >
            {t.label}
          </button>
        ))}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] underline"
            style={{ color: "var(--text-mute)" }}
          >
            Tentar outro PDF
          </button>
        )}
      </div>
    </div>
  );
}

type Estado =
  | { fase: "INICIAL" }
  | { fase: "PROCESSANDO"; nome: string }
  | { fase: "OK"; resultado: Extract<ProcessarResult, { ok: true }>; nome: string }
  | { fase: "ERRO"; erro: string };

export function UploadInteligenteCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "INICIAL" });
  const [arrastando, setArrastando] = useState(false);
  const estadoRef = useRef(estado);
  useEffect(() => { estadoRef.current = estado; }, [estado]);

  async function handle(file: File) {
    setEstado({ fase: "PROCESSANDO", nome: file.name });
    const fd = new FormData();
    fd.append("pdf", file);
    const res = await processarPdfIaAction(fd);
    if (!res.ok) {
      setEstado({ fase: "ERRO", erro: res.erro });
      return;
    }
    setEstado({ fase: "OK", resultado: res, nome: file.name });
  }

  // Native window-level listeners: cobrem o caso de o usuário soltar fora do
  // card (impede o browser de abrir o PDF) e capturam o drop dentro do card
  // sem depender de bubbling em filhos com handlers próprios.
  useEffect(() => {
    let counter = 0;
    function isFileDrag(e: DragEvent) {
      return Array.from(e.dataTransfer?.types ?? []).includes("Files");
    }
    function inside(target: EventTarget | null) {
      const el = sectionRef.current;
      return !!(el && target instanceof Node && el.contains(target));
    }
    function onDragEnter(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      counter += 1;
      const fase = estadoRef.current.fase;
      if ((fase === "INICIAL" || fase === "ERRO") && inside(e.target)) {
        setArrastando(true);
      }
    }
    function onDragOver(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = inside(e.target) ? "copy" : "none";
    }
    function onDragLeave(e: DragEvent) {
      if (!isFileDrag(e)) return;
      counter -= 1;
      if (counter <= 0) {
        counter = 0;
        setArrastando(false);
      }
    }
    function onDrop(e: DragEvent) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      counter = 0;
      setArrastando(false);
      const fase = estadoRef.current.fase;
      if (fase !== "INICIAL" && fase !== "ERRO") return;
      if (!inside(e.target)) return;
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setEstado({ fase: "ERRO", erro: "Apenas arquivos PDF são aceitos." });
        return;
      }
      handle(file);
    }
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  function continuarParaForm(rota: string, resultado: Extract<ProcessarResult, { ok: true }>) {
    // Salva o prefill em sessionStorage e abre o form com flag ?prefill=key
    const key = `cps-prefill-${Date.now()}`;
    const payload = {
      tipo: resultado.tipo,
      dados: resultado.dados,
      arquivoUrl: resultado.arquivoUrl,
      arquivoNome: resultado.arquivoNome,
    };
    try {
      window.sessionStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn("[UploadInteligenteCard] falha ao salvar prefill:", err);
    }
    router.push(`${rota}?prefill=${encodeURIComponent(key)}`);
  }

  return (
    <section
      ref={sectionRef}
      className="glass-tile relative overflow-hidden rounded-[24px] px-7 py-6 transition"
      style={{
        background: arrastando
          ? "linear-gradient(135deg, rgba(197,180,255,0.32), rgba(184,197,214,0.18)), var(--glass-2)"
          : "linear-gradient(135deg, rgba(197,180,255,0.14), rgba(184,197,214,0.06)), var(--glass-2)",
        outline: arrastando ? "2px dashed var(--lavender-deep, #6B5BB8)" : "none",
        outlineOffset: arrastando ? "-6px" : "0",
      }}
    >
      {arrastando && (
        <div
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[24px]"
          style={{ background: "rgba(197,180,255,0.18)" }}
        >
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold"
            style={{
              background: "white",
              color: "var(--lavender-deep, #6B5BB8)",
              boxShadow: "0 4px 18px rgba(107,91,184,0.25)",
            }}
          >
            <Upload className="h-4 w-4" /> Solte o PDF aqui
          </div>
        </div>
      )}
      <div className="flex items-start gap-4">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, var(--lavender), var(--sky))",
            boxShadow: "0 4px 18px rgba(197,180,255,0.45)",
          }}
        >
          <Sparkles className="h-5 w-5" style={{ color: "#0A0A0A" }} />
        </div>
        <div className="flex-1">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.22em", color: "var(--lavender-deep, #6B5BB8)" }}
          >
            Upload inteligente
          </p>
          <h3
            className="mt-1 text-[18px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            Anexe qualquer PDF — a IA classifica e direciona
          </h3>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
            Ata, Contrato, Empenho, Aditivo, Garantia, Notificação ou Procedimento — basta soltar o
            arquivo. O sistema identifica o tipo, extrai os dados e leva você ao formulário certo
            com tudo pré-preenchido.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) handle(f);
            }}
          />

          {estado.fase === "INICIAL" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn-primary inline-flex"
              >
                <Upload className="h-4 w-4" /> Anexar PDF
              </button>
            </div>
          )}

          {estado.fase === "PROCESSANDO" && (
            <div className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "var(--glass-1)" }}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--primary)" }} />
              <div>
                <p className="text-[13px] font-bold" style={{ color: "var(--text)" }}>
                  Classificando e extraindo dados…
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-mute)" }}>
                  {estado.nome}
                </p>
              </div>
            </div>
          )}

          {estado.fase === "ERRO" && (
            <div
              className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-[13px]"
              style={{
                background: "rgba(232,138,152,0.10)",
                border: "0.5px solid rgba(232,138,152,0.3)",
                color: "var(--coral)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">{estado.erro}</p>
                <button
                  type="button"
                  onClick={() => setEstado({ fase: "INICIAL" })}
                  className="mt-1 text-[11px] underline"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {estado.fase === "OK" && (
            <ResultadoBlock
              resultado={estado.resultado}
              nome={estado.nome}
              onContinuar={(rota) => continuarParaForm(rota, estado.resultado)}
              onReset={() => setEstado({ fase: "INICIAL" })}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ResultadoBlock({
  resultado,
  nome,
  onContinuar,
  onReset,
}: {
  resultado: Extract<ProcessarResult, { ok: true }>;
  nome: string;
  onContinuar: (rota: string) => void;
  onReset: () => void;
}) {
  const { tipo, confidence, racional, rotaForm, demo } = resultado;
  const altaConfianca = confidence >= 0.7;
  const confiancaPct = (confidence * 100).toFixed(0);

  // Cor do bloco principal: verde se alta confiança, âmbar se baixa, cinza se desconhecido
  const blocoEstilo = (() => {
    if (tipo === "DESCONHECIDO") {
      return {
        background: "rgba(15,14,12,0.04)",
        border: "0.5px solid var(--border-soft)",
      };
    }
    if (altaConfianca) {
      return {
        background: "rgba(93,216,182,0.10)",
        border: "0.5px solid rgba(93,216,182,0.3)",
      };
    }
    return {
      background: "rgba(212,175,55,0.10)",
      border: "0.5px solid rgba(212,175,55,0.35)",
    };
  })();

  return (
    <div className="mt-4 space-y-3">
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3"
        style={blocoEstilo}
      >
        {tipo === "DESCONHECIDO" ? (
          <FileQuestion className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--text-mute)" }} />
        ) : altaConfianca ? (
          <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--mint)" }} />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary-deep)" }} />
        )}
        <div className="flex-1">
          <p className="text-[13px] font-bold" style={{ color: "var(--text)" }}>
            {ROTULO_TIPO[tipo]}{" "}
            <span
              className="ml-1 text-[10px] font-bold uppercase"
              style={{
                letterSpacing: "0.08em",
                color: altaConfianca ? "var(--text-mute)" : "var(--primary-deep)",
              }}
            >
              {confiancaPct}% de confiança
            </span>
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-soft)" }}>
            {racional}
          </p>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-mute)" }}>
            {nome}
          </p>
        </div>
      </div>

      {/* CTA */}
      {rotaForm && altaConfianca && (
        <button
          type="button"
          onClick={() => onContinuar(rotaForm)}
          className="btn-primary inline-flex"
        >
          Revisar e salvar como {ROTULO_TIPO[tipo]} <ArrowRight className="h-4 w-4" />
        </button>
      )}
      {rotaForm && !altaConfianca && (
        <BaixaConfiancaBlock
          tipoSugerido={tipo}
          rotaForm={rotaForm}
          onContinuar={onContinuar}
          motivo="A IA não tem certeza desta classificação"
        />
      )}
      {!rotaForm && tipo !== "DESCONHECIDO" && (
        <div
          className="rounded-2xl px-4 py-3 text-[12px]"
          style={{
            background: "rgba(212,175,55,0.08)",
            border: "0.5px solid rgba(212,175,55,0.25)",
            color: "var(--text-soft)",
          }}
        >
          <p className="font-bold" style={{ color: "var(--primary-deep)" }}>
            Cadastro manual necessário
          </p>
          <p className="mt-1">
            Este tipo ({ROTULO_TIPO[tipo]}) é cadastrado dentro da contratação-pai.{" "}
            {ORIENTACOES_MANUAL[tipo]}
          </p>
        </div>
      )}
      {tipo === "DESCONHECIDO" && (
        <BaixaConfiancaBlock
          tipoSugerido="DESCONHECIDO"
          rotaForm={null}
          onContinuar={onContinuar}
          motivo="A IA não conseguiu identificar o tipo do documento"
          onReset={onReset}
        />
      )}

      {demo && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]"
          style={{
            background: "rgba(212,175,55,0.08)",
            border: "0.5px solid rgba(212,175,55,0.25)",
            color: "var(--primary-deep)",
          }}
        >
          <Beaker className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Modo demonstração</strong> — classificação baseada no nome do arquivo. Configure{" "}
            <code>ANTHROPIC_API_KEY</code> pra IA real.
          </span>
        </div>
      )}
    </div>
  );
}
