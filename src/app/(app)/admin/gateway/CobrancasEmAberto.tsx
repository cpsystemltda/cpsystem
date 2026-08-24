"use client";

import { useActionState } from "react";
import { cancelarCobrancaAdminAction } from "@/app/actions/cobrancaAdmin";

/**
 * Cobranças em aberto de todas as contas, com cancelamento em um clique.
 *
 * Regina 24/08: cobrança gerada por engano (a de R$ 997 que o cron abriu contra
 * a conta interna) ou de teste só dava pra cancelar entrando no painel do Asaas.
 */
type Linha = {
  id: string;
  competencia: string;
  forma: string;
  valor: number;
  status: string;
  vencimento: string;
  cliente: string;
  interna: boolean;
  observacoes: string | null;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CobrancasEmAberto({ cobrancas }: { cobrancas: Linha[] }) {
  const [state, action] = useActionState(cancelarCobrancaAdminAction, null);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">Cobranças em aberto</h2>
      <p className="mt-1 text-xs text-slate-500">
        Todas as contas. Cancelar aqui remove a cobrança no Asaas e no banco de uma vez — use pra
        cobrança gerada por engano ou de teste. Cobrança paga não aparece aqui.
      </p>

      {state?.erro && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{state.erro}</p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Cobrança cancelada no Asaas e no sistema.
        </p>
      )}

      {cobrancas.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhuma cobrança em aberto.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2">Conta</th>
                <th className="px-3 py-2">Competência</th>
                <th className="px-3 py-2">Forma</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{c.cliente}</div>
                    {c.interna && (
                      <span className="text-[10px] font-bold uppercase text-violet-700">
                        conta interna — não deveria ser cobrada
                      </span>
                    )}
                    {c.observacoes && (
                      <div className="text-[11px] text-slate-500">{c.observacoes}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.competencia}</td>
                  <td className="px-3 py-2 text-xs">{c.forma.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-right font-medium">{brl(c.valor)}</td>
                  <td className="px-3 py-2 text-xs">{c.vencimento}</td>
                  <td className="px-3 py-2 text-xs">{c.status}</td>
                  <td className="px-3 py-2 text-right">
                    <form action={action}>
                      <input type="hidden" name="cobrancaId" value={c.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                      >
                        Cancelar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
