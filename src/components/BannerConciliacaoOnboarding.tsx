"use client";

import { useActionState, useState } from "react";
import { Banknote, X } from "lucide-react";
import { configurarJanelaAction } from "@/app/actions/conciliacao";

// Aparece no dashboard quando cliente subiu pra INTERMEDIARIO/PREMIUM mas
// ainda nao configurou a janela mensal de conciliacao. Regina 21/07: assim que
// o cliente estiver no plano, o sistema pergunta o dia.
export function BannerConciliacaoOnboarding() {
  const [state, action, pending] = useActionState(configurarJanelaAction, null);
  const [fechado, setFechado] = useState(false);

  if (fechado || state?.ok) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Banknote className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Configure sua conciliação bancária
              </h3>
              <p className="mt-1 text-xs text-slate-700">
                Seu plano dá direito a conciliação bancária automática. Escolha o
                melhor dia do mês pra receber lembrete de subir o extrato — mandamos
                pelo WhatsApp 5 dias antes, 1 dia antes e no dia.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setFechado(true)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs font-medium text-slate-700">
              Melhor dia do mês
              <select
                name="diaMes"
                required
                defaultValue=""
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="" disabled>
                  — escolher —
                </option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Dia {d}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="optIn" value="true" />
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Salvando…" : "Salvar e ativar lembretes"}
            </button>
            {state?.erro ? (
              <span className="text-xs text-red-700">{state.erro}</span>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
