"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

/**
 * Editor de múltiplos endereços de entrega/execução do órgão.
 * Os campos são serializados como `enderecosEntrega[i][rotulo]` e
 * `enderecosEntrega[i][endereco]` no FormData.
 */
export function EnderecosEntregaEditor() {
  const [enderecos, setEnderecos] = useState<{ rotulo: string; endereco: string }[]>([
    { rotulo: "", endereco: "" },
  ]);

  const atualizar = (idx: number, campo: "rotulo" | "endereco", valor: string) => {
    setEnderecos((prev) => prev.map((e, i) => (i === idx ? { ...e, [campo]: valor } : e)));
  };
  const adicionar = () => setEnderecos((prev) => [...prev, { rotulo: "", endereco: "" }]);
  const remover = (idx: number) =>
    setEnderecos((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  return (
    <div className="space-y-2">
      {enderecos.map((e, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="text"
            placeholder="Rótulo (ex: Almoxarifado central)"
            name={`enderecosEntrega[${idx}][rotulo]`}
            value={e.rotulo}
            onChange={(ev) => atualizar(idx, "rotulo", ev.currentTarget.value)}
            className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Endereço completo (rua, nº, bairro, cidade/UF, CEP)"
            name={`enderecosEntrega[${idx}][endereco]`}
            value={e.endereco}
            onChange={(ev) => atualizar(idx, "endereco", ev.currentTarget.value)}
            className="col-span-8 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => remover(idx)}
            disabled={enderecos.length <= 1}
            className="col-span-1 grid place-items-center rounded-md text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-40"
            title="Remover endereço"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar endereço
      </button>
    </div>
  );
}

const FUNCOES_PADRAO: { funcao: "GESTOR" | "FISCAL_TECNICO" | "FISCAL_ADMINISTRATIVO"; rotulo: string }[] = [
  { funcao: "GESTOR", rotulo: "Gestor do contrato" },
  { funcao: "FISCAL_TECNICO", rotulo: "Fiscal técnico" },
  { funcao: "FISCAL_ADMINISTRATIVO", rotulo: "Fiscal administrativo" },
];

/**
 * Editor de pontos focais do órgão (Lei 14.133 art. 117).
 * Renderiza 3 cards padronizados: Gestor, Fiscal Técnico, Fiscal Administrativo.
 */
export function PontosFocaisEditor() {
  return (
    <div className="space-y-3">
      {FUNCOES_PADRAO.map((f, idx) => (
        <div key={f.funcao} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {f.rotulo}
            </span>
            <span className="text-[10px] text-slate-400">opcional</span>
          </div>
          <input type="hidden" name={`pontosFocais[${idx}][funcao]`} value={f.funcao} />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Nome"
              name={`pontosFocais[${idx}][nome]`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="E-mail"
              name={`pontosFocais[${idx}][email]`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Telefone"
              name={`pontosFocais[${idx}][telefone]`}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
