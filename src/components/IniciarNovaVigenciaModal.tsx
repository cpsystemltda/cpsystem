"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarPlus, X, AlertCircle, Loader2, Check } from "lucide-react";
import { iniciarNovaVigenciaAction } from "@/app/actions/vigencias";

// Modal usado na aba Saldo de Contrato/Ata para iniciar manualmente uma
// nova vigência sem precisar de Termo Aditivo. Caso de uso: prorrogação
// informal, correção de vigência mal cadastrada, ou aditivo cadastrado
// fora do sistema.
//
// Pré-preenche dataInicio com (dataFim da vigência atual + 1 dia) e
// dataFim com (dataInicio + 1 ano), pra acelerar o cadastro.

export function IniciarNovaVigenciaModal({
  contratoId,
  ataId,
  proximaOrdem,
  dataInicioSugerida,
  dataFimSugerida,
  valorAtual,
}: {
  contratoId?: string;
  ataId?: string;
  proximaOrdem: number;
  dataInicioSugerida: string; // YYYY-MM-DD
  dataFimSugerida: string;
  valorAtual: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (
      _prev: { ok: true } | { ok: false; erro: string } | null,
      fd: FormData,
    ) => {
      return await iniciarNovaVigenciaAction(fd);
    },
    null,
  );

  useEffect(() => {
    if (state && state.ok) setAberto(false);
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-700"
      >
        <CalendarPlus className="h-3.5 w-3.5" /> Iniciar nova vigência
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 grid place-items-center px-4"
          style={{ background: "rgba(15,14,12,0.5)" }}
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setAberto(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Iniciar {proximaOrdem}ª vigência
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Usado pra prorrogação manual (sem Termo Aditivo no sistema).
                  Empenhos novos cairão automaticamente nesta vigência via dataEmissao.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={formAction} className="mt-5 space-y-4">
              {contratoId && <input type="hidden" name="contratoId" value={contratoId} />}
              {ataId && <input type="hidden" name="ataId" value={ataId} />}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Data início *
                  </span>
                  <input
                    type="date"
                    name="dataInicio"
                    required
                    defaultValue={dataInicioSugerida}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Data fim *
                  </span>
                  <input
                    type="date"
                    name="dataFim"
                    required
                    defaultValue={dataFimSugerida}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Valor total (R$)
                </span>
                <input
                  type="text"
                  name="valorTotal"
                  defaultValue={valorAtual.toFixed(2).replace(".", ",")}
                  placeholder={`Sugerido: ${valorAtual.toFixed(2)}`}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
                <span className="mt-1 block text-[11px] text-slate-500">
                  Deixe em branco pra usar a soma dos itens copiados.
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  name="copiarItens"
                  value="true"
                  defaultChecked
                  className="mt-0.5"
                />
                <span className="text-xs text-slate-700">
                  <strong>Copiar itens da vigência anterior</strong> — replica todos os itens
                  com os mesmos valores. Desmarque pra começar a nova vigência em branco
                  (você adiciona os itens depois).
                </span>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Observação (opcional)
                </span>
                <input
                  type="text"
                  name="observacao"
                  placeholder="Ex: Prorrogação por interesse da administração — ofício 042/2026"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </label>

              {state && !state.ok && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {state.erro}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {pending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Criando…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Criar vigência
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
