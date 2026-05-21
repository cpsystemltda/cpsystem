"use client";

import { useState, useTransition } from "react";
import { Upload, Check, X, Loader2 } from "lucide-react";
import { salvarAnexoAdicionalAction } from "@/app/actions/uploads";

// Upload simples de 1 arquivo (sem IA). Após upload, expõe os hidden inputs
// `arquivoPdfUrl` / `arquivoPdfNome` pra o form pai consumir e persistir
// como Anexo do recurso (Empenho/AE/OS/AC/Carta-Contrato).
//
// Diferença do UploadPdfPanel: aquele extrai dados via IA pra preencher
// campos; este só anexa o documento. Usado nos instrumentos que não têm
// IA treinada (tudo exceto Nota de Empenho).
export function UploadArquivoSimples({
  titulo,
  descricao,
  onArquivoSalvo,
}: {
  titulo: string;
  descricao?: string;
  onArquivoSalvo?: (info: { url: string; nome: string }) => void;
}) {
  const [arquivo, setArquivo] = useState<{ url: string; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setErro(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      const res = await salvarAnexoAdicionalAction(formData);
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      const info = { url: res.url, nome: res.nome };
      setArquivo(info);
      onArquivoSalvo?.(info);
    });
  }

  function remover() {
    setArquivo(null);
    setErro(null);
  }

  return (
    <div className="glass-tile rounded-2xl px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700">
          <Upload className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
            {titulo}
          </p>
          {descricao && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
              {descricao}
            </p>
          )}

          {!arquivo && !enviando && (
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
              <Upload className="h-3.5 w-3.5" /> Selecionar arquivo
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFile}
                className="hidden"
              />
            </label>
          )}
          {enviando && (
            <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
            </p>
          )}
          {arquivo && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-1.5 text-xs">
              <Check className="h-3.5 w-3.5 text-emerald-700" />
              <span className="font-semibold text-emerald-800 truncate">{arquivo.nome}</span>
              <button
                type="button"
                onClick={remover}
                className="ml-auto rounded p-1 text-slate-500 hover:bg-white"
                title="Remover anexo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {erro && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
              {erro}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
