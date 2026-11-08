"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { ROTULO_SITUACAO, SITUACOES, type SituacaoColaborador } from "@/lib/colaboradores";
import { AVISO_SEM_DADOS_DE_SAUDE } from "@/lib/lgpd";
import { dataBrDia } from "@/lib/competencias";
import type { ColaboradorDto } from "@/lib/colaboradoresServer";
import { criarColaboradorAction, type ResultadoColab } from "@/app/actions/colaboradores";
import { useFormAction } from "@/lib/useFormAction";

const COR: Record<SituacaoColaborador, string> = { ATIVO: "bg-emerald-100 text-emerald-800", AFASTADO: "bg-amber-100 text-amber-900", DESLIGADO: "bg-slate-200 text-slate-700" };

export function ColaboradoresClient({ lista, podeEditar, busca, situacao, hojeIso }: { lista: ColaboradorDto[]; podeEditar: boolean; busca: string; situacao: string; hojeIso: string }) {
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const { state, onSubmit, pending } = useFormAction<ResultadoColab>(criarColaboradorAction, () => {
    setNovo(false);
    router.refresh();
  });
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2 text-xs">
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Buscar</span>
            <div className="mt-1 flex items-center gap-1">
              <input name="q" defaultValue={busca} placeholder="Nome, função ou CPF completo" className="w-64" />
              <button type="submit" className="btn-secondary !px-2.5" aria-label="Buscar">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </label>
          <label className="block">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Situação</span>
            <select name="situacao" defaultValue={situacao} className="mt-1 block" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
              <option value="">Todas</option>
              {SITUACOES.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_SITUACAO[s]}
                </option>
              ))}
            </select>
          </label>
        </form>
        {podeEditar && (
          <button type="button" className="btn-primary inline-flex" onClick={() => setNovo((v) => !v)}>
            <Plus className="h-4 w-4" /> Colaborador
          </button>
        )}
      </div>
      {state?.ok && state.mensagem && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{state.mensagem}</p>}

      {novo && podeEditar && (
        <form onSubmit={onSubmit} className="rounded-2xl border border-violet-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-900">Novo colaborador</p>
            <button type="button" onClick={() => setNovo(false)} aria-label="Fechar">
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Nome</span>
              <input name="nome" required className="mt-1 w-full" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">CPF</span>
              <input name="cpf" required inputMode="numeric" className="mt-1 w-full" placeholder="000.000.000-00" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Admissão</span>
              <input name="dataAdmissao" type="date" required className="mt-1 w-full" defaultValue={hojeIso} />
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Função</span>
              <input name="funcao" required className="mt-1 w-full" placeholder="Ex.: Auxiliar administrativo" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">CBO</span>
              <input name="cbo" className="mt-1 w-full" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Jornada / escala</span>
              <input name="jornada" className="mt-1 w-full" placeholder="44h · 12x36" />
            </label>
            <label className="block text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">Telefone (opcional)</span>
              <input name="telefone" className="mt-1 w-full" />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{AVISO_SEM_DADOS_DE_SAUDE}</p>
          {state?.erro && <p className="mt-2 text-xs text-red-700">{state.erro}</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Salvando…" : "Cadastrar"}
            </button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
          {busca || situacao ? "Nenhum colaborador com esses filtros." : "Nenhum colaborador cadastrado. Cadastre um a um ou importe a planilha-modelo."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Nome</th>
                <th className="px-3 py-2 text-left font-semibold">CPF</th>
                <th className="px-3 py-2 text-left font-semibold">Função</th>
                <th className="px-3 py-2 text-left font-semibold">Admissão</th>
                <th className="px-3 py-2 text-left font-semibold">Situação</th>
                <th className="px-3 py-2 text-left font-semibold">Alocação atual</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2">
                    <Link href={`/colaboradores/${c.id}`} className="font-semibold text-slate-900 hover:underline">
                      {c.nome}
                    </Link>
                    {c.anonimizadoEm && <span className="ml-2 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">anonimizado</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.cpfMascarado}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {c.funcao}
                    {c.jornada ? <span className="text-slate-400"> · {c.jornada}</span> : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{dataBrDia(c.dataAdmissao)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${COR[c.situacao]}`}>{ROTULO_SITUACAO[c.situacao]}</span>
                    {c.dataDesligamento && <span className="ml-1 text-[11px] text-slate-500">{dataBrDia(c.dataDesligamento)}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {c.alocacoes.length === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      c.alocacoes.map((a) => (
                        <div key={a.id}>
                          <Link href={`/contratos/${a.contratoId}?aba=equipe`} className="text-blue-700 hover:underline">
                            {a.contratoNumero}
                          </Link>
                          {a.itemDescricao ? ` · ${a.itemDescricao}` : ""} <span className="text-slate-400">({a.tipo.toLowerCase()})</span>
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
