"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Building2, UserCheck, Crown } from "lucide-react";
import { trocarVisaoAction, type Visao } from "@/lib/visao";

const ROTULOS: Record<Visao, { titulo: string; sub: string; icon: React.ComponentType<{ className?: string }> }> = {
  ADMIN_PLATAFORMA: {
    titulo: "Adm CP System",
    sub: "Clientes, recorrência e vencimentos",
    icon: Crown,
  },
  EMPRESA: { titulo: "Empresa (multiempresas)", sub: "Até 4 CNPJs no mesmo grupo", icon: Building2 },
  ANALISTA: { titulo: "Analista de licitações", sub: "Empresas e comissões", icon: UserCheck },
};

export function SeletorVisao({ visaoAtual }: { visaoAtual: Visao }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  const Atual = ROTULOS[visaoAtual].icon;
  const opcoes: Visao[] = ["ADMIN_PLATAFORMA", "EMPRESA", "ANALISTA"];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
      >
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-violet-600 to-blue-700 text-white">
          <Atual className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">Visão atual</p>
          <p className="truncate text-xs font-semibold text-slate-900">{ROTULOS[visaoAtual].titulo}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Trocar perspectiva
          </p>
          {opcoes.map((v) => {
            const Icon = ROTULOS[v].icon;
            const ativo = v === visaoAtual;
            return (
              <form key={v} action={trocarVisaoAction}>
                <input type="hidden" name="visao" value={v} />
                <button
                  type="submit"
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                    ativo ? "bg-violet-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                      v === "ADMIN_PLATAFORMA"
                        ? "bg-gradient-to-br from-violet-600 to-blue-700 text-white"
                        : v === "EMPRESA"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{ROTULOS[v].titulo}</p>
                    <p className="text-[11px] text-slate-500">{ROTULOS[v].sub}</p>
                  </div>
                  {ativo && <Check className="h-4 w-4 text-violet-600" />}
                </button>
              </form>
            );
          })}
          <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            Visível porque você é gestor da plataforma.
          </p>
        </div>
      )}
    </div>
  );
}
