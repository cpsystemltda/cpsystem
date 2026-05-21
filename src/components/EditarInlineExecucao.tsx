"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { atualizarBasicoEmpenhoAction } from "@/app/actions/contratacoes";

// Componente de edição inline (click-to-edit) pros campos básicos da
// execução: número e objeto/descrição. Click no texto vira input, ESC
// cancela, Enter (ou blur) salva via server action. Bloqueia se o
// usuário não tem permissão ou se o status é PAGO (server retorna erro).

export function EditavelInline({
  empenhoId,
  campo,
  valor,
  podeEditar,
  className,
  multiline = false,
  placeholder,
}: {
  empenhoId: string;
  campo: "numero" | "objeto";
  valor: string;
  podeEditar: boolean;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [valorAtual, setValorAtual] = useState(valor);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  function iniciar() {
    if (!podeEditar) return;
    setErro(null);
    setEditando(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (inputRef.current && "select" in inputRef.current) inputRef.current.select();
    });
  }

  function cancelar() {
    setValorAtual(valor); // restaura
    setErro(null);
    setEditando(false);
  }

  function salvar() {
    const novo = valorAtual.trim();
    if (novo === valor.trim()) {
      setEditando(false);
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await atualizarBasicoEmpenhoAction(empenhoId, { [campo]: novo });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      setEditando(false);
    });
  }

  if (!editando) {
    return (
      <span className="group inline-flex items-center gap-2">
        <span className={className}>{valor}</span>
        {podeEditar && (
          <button
            type="button"
            onClick={iniciar}
            title="Editar"
            aria-label="Editar"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-2">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={valorAtual}
          onChange={(ev) => setValorAtual(ev.currentTarget.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              ev.preventDefault();
              cancelar();
            } else if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
              ev.preventDefault();
              salvar();
            }
          }}
          placeholder={placeholder}
          rows={3}
          disabled={salvando}
          className="min-w-[300px] flex-1 resize-y rounded-md border border-slate-300 px-2.5 py-1.5 text-sm leading-snug outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={valorAtual}
          onChange={(ev) => setValorAtual(ev.currentTarget.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              ev.preventDefault();
              cancelar();
            } else if (ev.key === "Enter") {
              ev.preventDefault();
              salvar();
            }
          }}
          placeholder={placeholder}
          disabled={salvando}
          className="min-w-[180px] rounded-md border border-slate-300 px-2 py-0.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          title="Salvar (Enter)"
          aria-label="Salvar"
          className="grid h-7 w-7 place-items-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={cancelar}
          disabled={salvando}
          title="Cancelar (ESC)"
          aria-label="Cancelar"
          className="grid h-7 w-7 place-items-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {erro && (
        <span className="ml-1 text-xs font-semibold text-red-700">{erro}</span>
      )}
    </span>
  );
}
