"use client";

import { useActionState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { excluirVigenciaAction } from "@/app/actions/vigencias";

/**
 * Botão "Excluir" de uma vigência iniciada manualmente — aba Saldo.
 *
 * Só aparece onde faz sentido (vigência manual, não a 1ª); o resto da regra
 * — execução lançada, item preso — é da action, que devolve o motivo e ele
 * aparece aqui mesmo, embaixo do botão.
 */
export function ExcluirVigenciaBotao({
  vigenciaId,
  ordem,
  periodo,
  temSeguintes,
}: {
  vigenciaId: string;
  ordem: number;
  periodo: string;
  temSeguintes: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: true } | { ok: false; erro: string } | null, fd: FormData) => {
      return await excluirVigenciaAction(fd);
    },
    null,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="vigenciaId" value={vigenciaId} />
        <button
          type="submit"
          disabled={pending}
          onClick={(ev) => {
            const aviso =
              `Excluir a ${ordem}ª vigência (${periodo})?\n\n` +
              `Os itens copiados para ela somem junto.` +
              (temSeguintes ? ` As vigências seguintes passam a ser ${ordem}ª, ${ordem + 1}ª…` : "");
            if (!window.confirm(aviso)) ev.preventDefault();
          }}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50"
          style={{
            background: "rgba(232,138,152,0.12)",
            color: "var(--coral)",
            border: "0.5px solid rgba(232,138,152,0.3)",
          }}
          title="Excluir esta vigência (iniciada manualmente)"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Excluir
        </button>
      </form>
      {state && !state.ok && (
        <p
          className="max-w-md rounded-lg px-3 py-2 text-right text-[12px]"
          style={{
            background: "rgba(232,138,152,0.10)",
            border: "0.5px solid rgba(232,138,152,0.3)",
            color: "var(--coral)",
          }}
        >
          {state.erro}
        </p>
      )}
    </div>
  );
}
