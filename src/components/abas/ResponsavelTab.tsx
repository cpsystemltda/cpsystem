"use client";

import { useState, useTransition } from "react";
import { UserRound, Check } from "lucide-react";
import { definirResponsavelAction } from "@/app/actions/responsavel";

/**
 * Aba "Colaborador responsável" — quem, na empresa, acompanha este fornecimento.
 *
 * Demanda de cliente 24/09/2026. O campo é preenchido no cadastro, mas quem
 * acompanha muda com o tempo: pessoa sai de férias, troca de área, deixa a
 * empresa. Por isso a troca tem lugar próprio, e não exige abrir o formulário
 * inteiro de edição — abrir o cadastro completo só para trocar um nome é onde
 * se erra outro campo sem querer.
 */
type Colaborador = { id: string; nome: string; email: string };

export function ResponsavelTab({
  empenhoId,
  responsavelAtual,
  colaboradores,
  podeEditar,
}: {
  empenhoId: string;
  responsavelAtual: Colaborador | null;
  colaboradores: Colaborador[];
  podeEditar: boolean;
}) {
  const [selecionado, setSelecionado] = useState(responsavelAtual?.id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();

  function salvar() {
    setErro(null);
    setSalvo(false);
    const fd = new FormData();
    fd.set("empenhoId", empenhoId);
    fd.set("responsavelId", selecionado);
    startTransition(async () => {
      const r = await definirResponsavelAction(null, fd);
      if (r?.erro) setErro(r.erro);
      else setSalvo(true);
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Responsável atual
        </p>
        <div className="mt-2 flex items-center gap-2">
          <UserRound className="h-4 w-4 text-slate-400" />
          {responsavelAtual ? (
            <span className="text-sm font-semibold text-slate-800">
              {responsavelAtual.nome}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {responsavelAtual.email}
              </span>
            </span>
          ) : (
            <span className="text-sm text-slate-500">Nenhum colaborador indicado.</span>
          )}
        </div>
      </div>

      {podeEditar ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <label className="mb-2 block text-xs font-medium text-slate-600">
            Trocar o responsável pelo acompanhamento
          </label>
          <select
            value={selecionado}
            onChange={(e) => {
              setSelecionado(e.target.value);
              setSalvo(false);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">— Sem responsável definido —</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {c.email}
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={isPending || selecionado === (responsavelAtual?.id ?? "")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {isPending ? "Salvando…" : "Salvar responsável"}
            </button>
            <a href="/equipe" className="text-xs font-medium text-blue-700 hover:underline">
              Cadastrar colaborador no módulo Equipe →
            </a>
          </div>

          {salvo && <p className="mt-2 text-xs font-medium text-emerald-700">Responsável atualizado.</p>}
          {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Você não tem permissão para alterar o responsável deste fornecimento.
        </p>
      )}
    </div>
  );
}
