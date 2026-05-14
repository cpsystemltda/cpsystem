"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, FileText, Loader2 } from "lucide-react";
import { salvarAnexoAdicionalAction } from "@/app/actions/uploads";

const CATEGORIAS = [
  { value: "CONTRATUAL", label: "Documento principal (Empenho/AE/etc.)" },
  { value: "ADITIVO", label: "Aditivo" },
  { value: "APOSTILAMENTO", label: "Apostilamento" },
  { value: "GARANTIA", label: "Garantia" },
  { value: "NF", label: "Nota Fiscal" },
  { value: "COMPROVANTE", label: "Comprovante" },
  { value: "OUTRO", label: "Outro" },
];

type Anexo = { url: string; nome: string; categoria: string };

/**
 * Editor de anexos extras durante o cadastro de um Fornecimento/Execução
 * (M3.3 ajuste 6). Cada upload sobe direto pro Vercel Blob via server
 * action e a URL fica em estado local — quem renderiza esse componente é
 * responsável por enviar `anexosAdicionais[i][url|nome|categoria]` como
 * hidden inputs no form principal, pra que o `criarEmpenhoAction` crie
 * os registros Anexo após salvar.
 */
export function AnexosAdicionaisEditor({
  anexos,
  onChange,
}: {
  anexos: Anexo[];
  onChange: (anexos: Anexo[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState("CONTRATUAL");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleFile(file: File) {
    setEnviando(true);
    setErro(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await salvarAnexoAdicionalAction(fd);
    setEnviando(false);
    if (!res.ok) {
      setErro(res.erro);
      return;
    }
    onChange([...anexos, { url: res.url, nome: res.nome, categoria }]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[200px]">
          <span
            className="mb-1.5 block text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
          >
            Categoria
          </span>
          <select
            value={categoria}
            onChange={(ev) => setCategoria(ev.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-medium"
            style={{
              border: "0.5px solid var(--hairline)",
              background: "rgba(255,255,255,0.7)",
            }}
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[280px]">
          <span
            className="mb-1.5 block text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.16em", color: "var(--text-mute)" }}
          >
            Arquivo (PDF, PNG ou JPG até 25MB)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            disabled={enviando}
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ border: "0.5px solid var(--hairline)", background: "rgba(255,255,255,0.7)" }}
          />
        </label>
        {enviando && (
          <span className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--primary-deep)" }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
          </span>
        )}
      </div>

      {erro && (
        <div
          className="rounded-[10px] px-3 py-2 text-xs"
          style={{
            background: "rgba(232,138,152,0.10)",
            border: "0.5px solid rgba(232,138,152,0.3)",
            color: "var(--coral-deep)",
          }}
        >
          {erro}
        </div>
      )}

      {anexos.length > 0 && (
        <ul className="space-y-1.5">
          {anexos.map((a, idx) => {
            const cat = CATEGORIAS.find((c) => c.value === a.categoria);
            return (
              <li
                key={idx}
                className="flex items-center justify-between gap-3 rounded-[12px] px-4 py-2.5 text-sm"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  border: "0.5px solid var(--hairline)",
                }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--primary-deep)" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold" style={{ color: "var(--text)" }}>
                      {a.nome}
                    </p>
                    <p className="text-[10px] uppercase" style={{
                      letterSpacing: "0.12em", color: "var(--text-soft)",
                    }}>
                      {cat?.label ?? a.categoria}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(anexos.filter((_, i) => i !== idx))}
                  className="rounded p-1.5 transition hover:opacity-70"
                  style={{ color: "var(--coral-deep)" }}
                  title="Remover anexo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {anexos.length === 0 && !enviando && (
        <p className="text-xs" style={{ color: "var(--text-mute)" }}>
          Nenhum anexo adicional cadastrado. Use o seletor acima pra anexar.
        </p>
      )}
    </div>
  );
}
