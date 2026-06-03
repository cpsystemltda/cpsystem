"use client";

import { useRef, useState } from "react";
import { Sparkles, Upload, Check, AlertCircle, Loader2, Beaker } from "lucide-react";

type Resultado<T> =
  | { ok: true; dados: T; demo?: boolean; arquivoUrl?: string; nomeArquivo?: string; tamanhoBytes?: number }
  | { ok: false; erro: string };

// Limite de upload — bate com o limite em chamarClaudeComPdf (32MB) e
// salvarArquivo (25MB). Usamos 25MB pra rejeitar antes de bater no server.
const MAX_BYTES_PDF = 25 * 1024 * 1024;

function ehPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadPdfPanel<T>({
  titulo,
  descricao,
  action,
  onSuccess,
  onArquivoSalvo,
  badgeAposExtracao,
}: {
  titulo: string;
  descricao: string;
  action: (formData: FormData) => Promise<Resultado<T>>;
  onSuccess: (dados: T) => void;
  /** Callback opcional acionado quando o PDF foi persistido no storage.
   * Recebe a URL pública pra ser usada como hidden input no form principal. */
  onArquivoSalvo?: (info: { url: string; nome: string }) => void;
  /** ex: (dados) => `${dados.itens.length} item(ns) preenchido(s)` */
  badgeAposExtracao?: (dados: T) => string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pdfNome, setPdfNome] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [modoDemo, setModoDemo] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function onDragOver(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!extraindo) setDragOver(true);
  }
  function onDragLeave(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(false);
  }
  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setDragOver(false);
    if (extraindo) return;
    const file = ev.dataTransfer.files?.[0];
    if (!file) return;
    handleArquivo(file);
  }

  async function handleArquivo(file: File) {
    // Validacao client-side — rejeita ANTES de bater no servidor pra
    // dar feedback imediato e nao consumir token de IA por nada.
    if (!ehPdf(file)) {
      setErro(`Esperado um PDF — recebido "${file.name}" (${file.type || "tipo desconhecido"}).`);
      return;
    }
    if (file.size === 0) {
      setErro(`Arquivo "${file.name}" está vazio (0 bytes).`);
      return;
    }
    if (file.size > MAX_BYTES_PDF) {
      setErro(
        `PDF "${file.name}" tem ${formatarTamanho(file.size)} — excede o limite de ${formatarTamanho(MAX_BYTES_PDF)}.`,
      );
      return;
    }

    setExtraindo(true);
    setErro(null);
    setPdfNome(file.name);
    setBadge(null);
    setModoDemo(false);

    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const res = await action(fd);

      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      onSuccess(res.dados);
      if (res.arquivoUrl && onArquivoSalvo) {
        onArquivoSalvo({ url: res.arquivoUrl, nome: res.nomeArquivo ?? file.name });
      }
      if (res.demo) setModoDemo(true);
      if (badgeAposExtracao) setBadge(badgeAposExtracao(res.dados));
      else setBadge("Dados preenchidos");
    } catch (e) {
      // Erros de rede / runtime que escapam do try-catch da server action
      // (Vercel timeout 60s, JSON corrompido, etc.). Antes silenciava.
      setErro(
        e instanceof Error
          ? `Falha de comunicação: ${e.message}`
          : "Falha ao enviar o PDF. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setExtraindo(false);
      // Reset do input pra permitir reselecionar o MESMO arquivo (sem
      // isso, o onChange nao dispara se o usuario escolher o mesmo PDF).
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`glass-tile overflow-hidden rounded-[20px] px-7 py-6 transition ${
        dragOver ? "ring-2 ring-offset-2" : ""
      }`}
      style={{
        background: dragOver
          ? "linear-gradient(135deg, rgba(197,180,255,0.28), rgba(184,197,214,0.10)), var(--glass-2)"
          : "linear-gradient(135deg, rgba(197,180,255,0.12), rgba(184,197,214,0.04)), var(--glass-2)",
        ...(dragOver ? { boxShadow: "0 0 0 2px var(--lavender)" } : {}),
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
            {titulo}
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
            {descricao}
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-mute)" }}>
            {dragOver ? "Solte o PDF aqui…" : "Arraste o PDF aqui ou clique no botão abaixo."}
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
              className="btn-primary inline-flex disabled:cursor-not-allowed disabled:opacity-60"
            >
              {extraindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extraindo dados…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {pdfNome ? "Outro PDF" : "Anexar PDF"}
                </>
              )}
            </button>
            {pdfNome && !extraindo && (
              <span
                className="max-w-md truncate text-xs"
                style={{ color: "var(--text-mute)" }}
              >
                {pdfNome}
              </span>
            )}
            {badge && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: "rgba(93,216,182,0.18)",
                  color: "var(--mint)",
                  border: "0.5px solid rgba(93,216,182,0.3)",
                }}
              >
                <Check className="h-3 w-3" /> {badge}
              </span>
            )}
          </div>

          {erro && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "rgba(232,138,152,0.10)",
                border: "0.5px solid rgba(232,138,152,0.3)",
                color: "var(--coral)",
              }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {modoDemo && (
            <div
              className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
              style={{
                background: "rgba(212,175,55,0.10)",
                border: "0.5px solid rgba(212,175,55,0.3)",
                color: "var(--primary-deep)",
              }}
            >
              <Beaker className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Modo demonstração ativo</strong> — dados de exemplo pra você testar
                o fluxo sem a IA real. Configure{" "}
                <code
                  className="rounded px-1 py-0.5 font-mono"
                  style={{ background: "rgba(15,14,12,0.06)", color: "var(--primary-deep)" }}
                >
                  ANTHROPIC_API_KEY
                </code>{" "}
                no <code
                  className="rounded px-1 py-0.5 font-mono"
                  style={{ background: "rgba(15,14,12,0.06)", color: "var(--primary-deep)" }}
                >
                  .env
                </code>{" "}
                pra ativar a extração via IA.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
