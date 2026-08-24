"use client";

import { useActionState } from "react";
import { gerarFaturaEmFaltaAction } from "@/app/actions/faturaEmFalta";

/**
 * Contas ativas cuja competência do mês não tem cobrança nenhuma.
 *
 * Regina 24/08: "se ele só fez o pagamento de julho, ele tem que ser cobrado em
 * agosto imediatamente, já passou da data." O ciclo já foi corrigido pra frente;
 * esta tela recupera o mês que ficou pra trás antes da correção.
 */
type Linha = { contaId: string; cliente: string; competencia: string; ultimoPago: string | null };

export function FaturasEmFalta({ linhas }: { linhas: Linha[] }) {
  const [state, action] = useActionState(gerarFaturaEmFaltaAction, null);

  return (
    <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
      <h2 className="text-sm font-bold text-slate-900">Faturas do mês não geradas</h2>
      <p className="mt-1 text-xs text-slate-600">
        Conta ativa cuja competência do mês corrente não tem cobrança nenhuma. Gerar aqui cria a
        fatura por PIX com 3 dias de prazo e recoloca o ciclo no lugar.
      </p>

      {state?.erro && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{state.erro}</p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          {state.mensagem}
        </p>
      )}

      {linhas.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          Nenhuma. Toda conta ativa tem a fatura do mês gerada.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {linhas.map((l) => (
            <li
              key={l.contaId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{l.cliente}</p>
                <p className="text-xs text-slate-500">
                  Sem cobrança para {l.competencia}
                  {l.ultimoPago ? ` · último pagamento: ${l.ultimoPago}` : ""}
                </p>
              </div>
              <form action={action}>
                <input type="hidden" name="contaId" value={l.contaId} />
                <input type="hidden" name="competencia" value={l.competencia} />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Gerar fatura de {l.competencia}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
