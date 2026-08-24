"use client";

import { useActionState } from "react";
import { sincronizarAssinaturaAction } from "@/app/actions/sincronizarAssinatura";

/**
 * Puxa do gateway as mensalidades que a assinatura gerou sozinha.
 *
 * Serve pra responder "o gateway cobrou esse mês?" sem sair do sistema — e pra
 * recuperar os meses que ficaram invisíveis antes do webhook ser corrigido.
 */
type Linha = { contaId: string; cliente: string; cobrancasNoBanco: number };

export function SincronizarAssinaturas({ linhas }: { linhas: Linha[] }) {
  const [state, action] = useActionState(sincronizarAssinaturaAction, null);

  if (linhas.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Assinaturas no gateway</h2>
      <p className="mt-1 text-xs text-slate-500">
        Contas em que o gateway cobra sozinho todo mês. Sincronizar traz as mensalidades geradas lá
        pra cá — histórico do cliente, receita e ciclo de cobrança.
      </p>

      {state?.erro && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{state.erro}</p>
      )}
      {state?.ok && state.resumo && (
        <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {state.resumo.total} cobrança(s) no gateway · {state.resumo.importadas} importada(s) ·{" "}
          {state.resumo.atualizadas} atualizada(s).
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {linhas.map((l) => (
          <li
            key={l.contaId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{l.cliente}</p>
              <p className="text-xs text-slate-500">{l.cobrancasNoBanco} cobrança(s) no sistema</p>
            </div>
            <form action={action}>
              <input type="hidden" name="contaId" value={l.contaId} />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Sincronizar com o gateway
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
