"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { BANCOS_BR, buscarBancos, formatarBancoSalvo, type Banco } from "@/lib/bancos";

type Props = {
  defaultValue?: string;
  erro?: string;
  name?: string;
  label?: string;
  span?: 1 | 2 | 3 | 4;
};

/**
 * Campo de Banco com autocomplete: usuário digita código (ex: "341")
 * ou nome ("Itaú", "nubank") e seleciona da lista. O valor enviado é
 * "código - nome" pra facilitar leitura humana em relatórios.
 */
export function CampoBanco({
  defaultValue = "",
  erro,
  name = "banco",
  label = "Banco",
  span = 2,
}: Props) {
  const [valor, setValor] = useState(defaultValue);
  const [escolhido, setEscolhido] = useState<Banco | null>(() => {
    // Tenta extrair banco do defaultValue ("341 - Itaú")
    const m = defaultValue.match(/^(\d{3})\s*-\s*(.+)$/);
    if (!m) return null;
    return BANCOS_BR.find((b) => b.codigo === m[1]) ?? null;
  });
  const [aberto, setAberto] = useState(false);
  const refContainer = useRef<HTMLDivElement>(null);
  const sugestoes = buscarBancos(valor);

  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (refContainer.current && !refContainer.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function selecionar(b: Banco) {
    setEscolhido(b);
    setValor(formatarBancoSalvo(b.codigo, b.apelido));
    setAberto(false);
  }

  if (escolhido) {
    return (
      <div className={`flex flex-col gap-1 ${spanCls}`}>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{escolhido.apelido}</p>
            <p className="truncate text-[11px] text-slate-500">
              Código {escolhido.codigo} · {escolhido.nome}
            </p>
          </div>
          <input type="hidden" name={name} value={formatarBancoSalvo(escolhido.codigo, escolhido.apelido)} />
          <button
            type="button"
            onClick={() => {
              setEscolhido(null);
              setValor("");
              setAberto(true);
            }}
            className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-white"
            title="Trocar banco"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    );
  }

  return (
    <div ref={refContainer} className={`relative flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          name={name}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder="Digite o nome ou código (ex: 341, Itaú)"
          autoComplete="off"
          className={`w-full rounded-md border bg-white pl-9 pr-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
            erro ? "border-red-400 focus:border-red-400" : "border-slate-300 focus:border-blue-500"
          }`}
        />
      </div>
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {sugestoes.map((b) => (
            <li key={`${b.codigo}-${b.apelido}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionar(b);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="grid h-7 w-12 shrink-0 place-items-center rounded bg-slate-900 font-mono text-xs font-bold text-white">
                  {b.codigo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{b.apelido}</span>
                  <span className="block truncate text-[11px] text-slate-500">{b.nome}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {aberto && sugestoes.length === 0 && valor.trim().length > 0 && (
        <p className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg">
          Nenhum banco encontrado. Você pode digitar mesmo assim — o valor será salvo como informado.
        </p>
      )}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
