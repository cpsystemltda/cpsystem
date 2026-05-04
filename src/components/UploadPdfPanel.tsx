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
    <section className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 text-white shadow-md">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <p className="mt-1 text-sm text-slate-600">{descricao}</p>

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
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {extraindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extraindo dados…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {pdfNome ? "Anexar outro PDF" : "Anexar PDF"}
                </>
              )}
            </button>
            {pdfNome && !extraindo && (
              <span className="max-w-md truncate text-xs text-slate-500">{pdfNome}</span>
            )}
            {badge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                <Check className="h-3 w-3" /> {badge}
              </span>
            )}
          </div>

          {erro && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {modoDemo && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Beaker className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Modo demonstração ativo</strong> — dados de exemplo carregados pra você testar o
                fluxo sem a IA real. Pra ativar a extração via IA, configure{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">ANTHROPIC_API_KEY</code> no
                arquivo <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">.env</code> e
                reinicie o servidor.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
