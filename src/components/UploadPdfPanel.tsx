"use client";

import { useRef, useState } from "react";
import { Sparkles, Upload, Check, AlertCircle, Loader2, Beaker } from "lucide-react";

type Resultado<T> =
  | { ok: true; dados: T; demo?: boolean }
  | { ok: false; erro: string };

export function UploadPdfPanel<T>({
  titulo,
  descricao,
  action,
  onSuccess,
  badgeAposExtracao,
}: {
  titulo: string;
  descricao: string;
  action: (formData: FormData) => Promise<Resultado<T>>;
  onSuccess: (dados: T) => void;
  /** ex: (dados) => `${dados.itens.length} item(ns) preenchido(s)` */
  badgeAposExtracao?: (dados: T) => string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pdfNome, setPdfNome] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);
  const [modoDemo, setModoDemo] = useState(false);

  async function handleArquivo(file: File) {
    setExtraindo(true);
    setErro(null);
    setPdfNome(file.name);
    setBadge(null);
    setModoDemo(false);

    const fd = new FormData();
    fd.append("pdf", file);
    const res = await action(fd);
    setExtraindo(false);

    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    onSuccess(res.dados);
    if (res.demo) setModoDemo(true);
    if (badgeAposExtracao) setBadge(badgeAposExtracao(res.dados));
    else setBadge("Dados preenchidos");
  }

  return (
    <section
      className="glass-tile overflow-hidden rounded-[20px] px-7 py-6"
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
            {titulo}
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-soft)" }}>
            {descricao}
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
