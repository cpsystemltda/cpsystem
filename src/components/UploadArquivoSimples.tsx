"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, Check, X, Loader2 } from "lucide-react";
import { salvarAnexoAdicionalAction } from "@/app/actions/uploads";

// Upload simples de 1 arquivo (sem IA). Após upload, expõe os hidden inputs
// `arquivoPdfUrl` / `arquivoPdfNome` pra o form pai consumir e persistir
// como Anexo do recurso (Empenho/AE/OS/AC/Carta-Contrato).
//
// Diferença do UploadPdfPanel: aquele extrai dados via IA pra preencher
// campos; este só anexa o documento. Suporta drag-and-drop e clique.
export function UploadArquivoSimples({
  titulo,
  descricao,
  onArquivoSalvo,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
}: {
  titulo: string;
  descricao?: string;
  onArquivoSalvo?: (info: { url: string; nome: string }) => void;
  accept?: string;
}) {
  const [arquivo, setArquivo] = useState<{ url: string; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function processarArquivo(file: File) {
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

  function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    processarArquivo(file);
  }

  function onDragOver(ev: React.DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!enviando && !arquivo) setDragOver(true);
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
    if (enviando || arquivo) return;
    const file = ev.dataTransfer.files?.[0];
    if (!file) return;
    processarArquivo(file);
  }

  function remover() {
    setArquivo(null);
    setErro(null);
    onArquivoSalvo?.({ url: "", nome: "" });
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`glass-tile rounded-2xl px-5 py-4 transition ${
        dragOver ? "ring-2 ring-offset-2" : ""
      }`}
      style={{
        background: dragOver
          ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(184,197,214,0.04)), var(--glass-2)"
          : undefined,
        ...(dragOver ? { boxShadow: "0 0 0 2px var(--amber, #d97706)" } : {}),
      }}
    >
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
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-mute)" }}>
            {dragOver ? "Solte o arquivo aqui…" : "Arraste o arquivo aqui ou clique no botão abaixo."}
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFile}
            className="hidden"
          />

          {!arquivo && !enviando && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              <Upload className="h-3.5 w-3.5" /> Selecionar arquivo
            </button>
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
