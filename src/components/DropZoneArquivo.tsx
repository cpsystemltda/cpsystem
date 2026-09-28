"use client";

import { useState, useRef } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

/**
 * Campo de anexo com arrastar-e-soltar.
 *
 * Morava dentro de `AvancarStatus`. Virou componente próprio em 27/09/2026
 * porque a etapa de entrega deixou de usar aquele componente — e o campo foi
 * junto, sem ninguém notar.
 *
 * Igor, em vídeo: *"o campo de carregar o documento comprobatório sumiu (...)
 * está nos outros, mas no da entrega ele sumiu. Aí eu não tenho mais como
 * colocar o comprovante de entrega. Tem que voltar com esse campo."*
 *
 * Ele tinha razão e o buraco era só de tela: a action de entrega sempre
 * aceitou o arquivo — o formulário é que não tinha onde soltar.
 */
const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 25 * 1024 * 1024;

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DropZoneArquivo({
  jaTem,
  onErro,
  rotulo,
}: {
  jaTem: boolean;
  onErro: (msg: string | null) => void;
  /** Texto de apoio — na entrega é "comprovante", não "arquivo". */
  rotulo?: string;
}) {

  const [arq, setArq] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function aceitar(f: File | undefined | null) {
    if (!f) return;
    if (!TIPOS_PERMITIDOS.includes(f.type)) {
      onErro(`Tipo "${f.type || "desconhecido"}" não permitido. Use PDF, JPG ou PNG.`);
      return;
    }
    if (f.size > MAX_BYTES) {
      onErro(`Arquivo "${f.name}" tem ${formatarTamanho(f.size)} — excede o limite de 25 MB.`);
      return;
    }
    // Pra que o FormData do form pai pegue o arquivo arrastado, jogamos
    // ele no input via DataTransfer (drag-and-drop nao alimenta input automaticamente).
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    setArq(f);
    onErro(null);
  }

  function limpar() {
    setArq(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        aceitar(e.dataTransfer.files?.[0]);
      }}
      onClick={() => {
        if (!arq) inputRef.current?.click();
      }}
      className={`rounded-md border border-dashed px-3 py-3 transition ${
        arrastando
          ? "border-blue-500 bg-blue-50"
          : arq
            ? "border-emerald-300 bg-emerald-50/50 cursor-default"
            : "border-slate-300 bg-slate-50/40 cursor-pointer hover:border-slate-400 hover:bg-slate-100/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        name="arquivo"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => aceitar(e.target.files?.[0])}
      />
      {arq ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-800">{arq.name}</p>
              <p className="text-[10px] text-slate-500">{formatarTamanho(arq.size)} · pronto pra enviar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              limpar();
            }}
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-red-600"
            title="Remover arquivo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <UploadCloud className={`h-4 w-4 shrink-0 ${arrastando ? "text-blue-600" : "text-slate-400"}`} />
          <p className="text-[11px] text-slate-600">
            {arrastando ? (
              <span className="font-medium text-blue-700">Solte o arquivo aqui</span>
            ) : (
              <>
                {jaTem ? `Substituir ${rotulo ?? "arquivo"}` : `Arraste o ${rotulo ?? "arquivo"}`}{" "}
                <span className="text-slate-400">ou</span>{" "}
                <span className="font-medium text-blue-700">clique pra selecionar</span>
                <span className="ml-1 text-slate-400">· PDF, JPG ou PNG · até 25 MB</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
