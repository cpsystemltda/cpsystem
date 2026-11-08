"use client";

import { useActionState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { confirmarValoresMensaisAction } from "@/app/actions/valoresMensais";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * ESP-002 RN06 (Igor 07/11/2026): contrato de mão de obra cadastrado antes
 * do módulo — o sistema não sabe se o valor dos itens é mensal ou da
 * vigência inteira. Pergunta uma vez; a resposta vai para o histórico.
 */
export function ValoresMensaisBanner({
  contratoId,
  somaItens,
  meses,
  podeEditar,
}: {
  contratoId: string;
  somaItens: number;
  meses: number;
  podeEditar: boolean;
}) {
  const [state, action, pendente] = useActionState(confirmarValoresMensaisAction, null);
  const mesesTxt = Number.isInteger(meses) ? String(meses) : meses.toFixed(2);
  return (
    <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <div className="flex-1">
          <p className="font-bold">Confirme se o valor dos itens é mensal</p>
          <p className="mt-0.5 text-xs text-sky-900">
            Os itens deste contrato de mão de obra somam <strong>{brl(somaItens)}</strong>. Em contrato de postos esse
            número costuma ser o valor <strong>mensal</strong>; a vigência atual tem {mesesTxt} meses, o que daria{" "}
            <strong>{brl(somaItens * meses)}</strong> no período. Escolha como o sistema deve ler os valores:
          </p>
          {podeEditar && (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={action}>
                <input type="hidden" name="contratoId" value={contratoId} />
                <input type="hidden" name="modo" value="MENSAL" />
                <button
                  type="submit"
                  disabled={pendente}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  {pendente && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Sim, os valores são mensais
                </button>
              </form>
              <form
                action={action}
                onSubmit={(ev) => {
                  if (
                    !window.confirm(
                      `Os valores serão divididos pelos meses de cada vigência (${mesesTxt} na atual) para virar mensais. ` +
                        `A soma dos itens passará de ${brl(somaItens)} para cerca de ${brl(somaItens / (meses || 1))} por mês. Confirmar?`,
                    )
                  ) {
                    ev.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="contratoId" value={contratoId} />
                <input type="hidden" name="modo" value="VIGENCIA" />
                <button
                  type="submit"
                  disabled={pendente}
                  className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                >
                  Não, são valores da vigência inteira
                </button>
              </form>
            </div>
          )}
          {state?.erro && <p className="mt-2 text-xs text-rose-700">{state.erro}</p>}
        </div>
      </div>
    </div>
  );
}
