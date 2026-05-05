"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Building2, Layers } from "lucide-react";
import { selecionarEmpresaAction } from "@/lib/empresaContexto";

export type EmpresaOpcao = { id: string; nome: string };

export function SeletorEmpresa({
  empresas,
  empresaIdAtual,
}: {
  empresas: EmpresaOpcao[];
  empresaIdAtual: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const empresaAtual = empresaIdAtual ? empresas.find((e) => e.id === empresaIdAtual) : null;
  const consolidado = !empresaAtual;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
      >
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${
            consolidado
              ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {consolidado ? <Layers className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {consolidado ? "Visão consolidada" : "Empresa em foco"}
          </p>
          <p className="truncate text-xs font-semibold text-slate-900">
            {consolidado ? "Todas as empresas" : empresaAtual!.nome}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Trocar empresa
          </p>

          <form action={selecionarEmpresaAction}>
            <input type="hidden" name="empresaId" value="TODAS" />
            <input type="hidden" name="from" value={pathname} />
            <button
              type="submit"
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                consolidado ? "bg-emerald-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
                <Layers className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">Todas as empresas</p>
                <p className="text-[11px] text-slate-500">Painel consolidado</p>
              </div>
              {consolidado && <Check className="h-4 w-4 text-emerald-600" />}
            </button>
          </form>

          <div className="max-h-72 overflow-y-auto">
            {empresas.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-500">
                Nenhuma empresa cadastrada ainda. Vá em &ldquo;Empresas (CNPJs)&rdquo;.
              </p>
            ) : (
              empresas.map((e) => {
                const ativo = e.id === empresaIdAtual;
                return (
                  <form key={e.id} action={selecionarEmpresaAction}>
                    <input type="hidden" name="empresaId" value={e.id} />
                    <input type="hidden" name="from" value={pathname} />
                    <button
                      type="submit"
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                        ativo ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-100 text-blue-700">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">{e.nome}</p>
                        <p className="text-[11px] text-slate-500">Visão individual</p>
                      </div>
                      {ativo && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  </form>
                );
              })
            )}
          </div>

          <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            O Dashboard sempre mostra todas as empresas. Atas, Contratos, Execução,
            Reajustes etc. respeitam a empresa em foco.
          </p>
        </div>
      )}
    </div>
  );
}
