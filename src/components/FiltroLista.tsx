"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

type Opcao = { value: string; label: string };

export function FiltroLista({
  placeholderBusca,
  filtros = [],
}: {
  placeholderBusca?: string;
  filtros?: { name: string; label: string; opcoes: Opcao[] }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(name: string, value: string) {
    const params = new URLSearchParams(sp);
    if (value) params.set(name, value);
    else params.delete(name);
    router.replace(`?${params.toString()}`);
  }

  const temFiltro = sp.toString().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          defaultValue={sp.get("q") || ""}
          placeholder={placeholderBusca || "Buscar…"}
          onChange={(e) => setParam("q", e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {filtros.map((f) => (
        <select
          key={f.name}
          value={sp.get(f.name) || ""}
          onChange={(e) => setParam(f.name, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">{f.label}</option>
          {f.opcoes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {temFiltro && (
        <button
          type="button"
          onClick={() => router.replace("?")}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          <X className="h-3 w-3" /> Limpar
        </button>
      )}
    </div>
  );
}
