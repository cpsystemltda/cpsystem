"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { OPCOES_FUNCAO_PONTO_FOCAL } from "@/lib/validators";

function formatarCepInput(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Editor de múltiplos endereços de entrega/execução do órgão.
 * Inclui busca automática por CEP via ViaCEP.
 * Serializa como `enderecosEntrega[i][rotulo]` e `enderecosEntrega[i][endereco]`.
 */
export function EnderecosEntregaEditor() {
  const [enderecos, setEnderecos] = useState<
    { rotulo: string; endereco: string; cep: string; carregando: boolean }[]
  >([{ rotulo: "", endereco: "", cep: "", carregando: false }]);

  const atualizar = (
    idx: number,
    patch: Partial<{ rotulo: string; endereco: string; cep: string; carregando: boolean }>,
  ) => {
    setEnderecos((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const adicionar = () =>
    setEnderecos((prev) => [
      ...prev,
      { rotulo: "", endereco: "", cep: "", carregando: false },
    ]);
  const remover = (idx: number) =>
    setEnderecos((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  async function buscarCep(idx: number, cepFormatado: string) {
    const cep = cepFormatado.replace(/\D/g, "");
    if (cep.length !== 8) return;
    atualizar(idx, { carregando: true });
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data.erro) {
        const enderecoNovo = `${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""}/${data.uf || ""}`;
        atualizar(idx, { endereco: enderecoNovo, carregando: false });
      } else {
        atualizar(idx, { carregando: false });
      }
    } catch {
      atualizar(idx, { carregando: false });
    }
  }

  return (
    <div className="space-y-3">
      {enderecos.map((e, idx) => (
        <div
          key={idx}
          className="grid grid-cols-12 gap-2 rounded-2xl px-3 py-3"
          style={{
            background: "var(--glass-2)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          <input
            type="text"
            placeholder="Rótulo (ex: Almoxarifado central)"
            name={`enderecosEntrega[${idx}][rotulo]`}
            value={e.rotulo}
            onChange={(ev) => atualizar(idx, { rotulo: ev.currentTarget.value })}
            className="col-span-3 rounded-md px-3 py-2 text-sm"
          />
          <div className="col-span-2 relative">
            <input
              type="text"
              placeholder="CEP"
              value={e.cep}
              onChange={(ev) => {
                const f = formatarCepInput(ev.target.value);
                atualizar(idx, { cep: f });
                if (f.replace(/\D/g, "").length === 8) buscarCep(idx, f);
              }}
              className="w-full rounded-md px-3 py-2 text-sm"
            />
            {e.carregando && (
              <Loader2
                className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin"
                style={{ color: "var(--primary)" }}
              />
            )}
          </div>
          <input
            type="text"
            placeholder="Endereço completo (rua, nº, bairro, cidade/UF)"
            name={`enderecosEntrega[${idx}][endereco]`}
            value={e.endereco}
            onChange={(ev) => atualizar(idx, { endereco: ev.currentTarget.value })}
            className="col-span-6 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => remover(idx)}
            disabled={enderecos.length <= 1}
            className="col-span-1 grid place-items-center rounded-md disabled:opacity-30"
            style={{ color: "var(--text-mute)" }}
            title="Remover endereço"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.8)",
          color: "var(--text-soft)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar endereço
      </button>
    </div>
  );
}

/**
 * Editor de pontos focais — função customizável (briefing PDF 2.6).
 * Sem pré-designações fixas. Usuário escolhe a função; quando "Outro"
 * aparece campo livre de descrição.
 */
export function PontosFocaisEditor() {
  const [pessoas, setPessoas] = useState<
    {
      nome: string;
      email: string;
      telefone: string;
      funcao: string;
      funcaoDescricao: string;
    }[]
  >([{ nome: "", email: "", telefone: "", funcao: "", funcaoDescricao: "" }]);

  const atualizar = (idx: number, patch: Partial<(typeof pessoas)[0]>) => {
    setPessoas((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const adicionar = () =>
    setPessoas((prev) => [
      ...prev,
      { nome: "", email: "", telefone: "", funcao: "", funcaoDescricao: "" },
    ]);
  const remover = (idx: number) =>
    setPessoas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  return (
    <div className="space-y-3">
      {pessoas.map((p, idx) => (
        <div
          key={idx}
          className="rounded-2xl px-4 py-4"
          style={{
            background: "var(--glass-2)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          <div className="grid grid-cols-12 gap-3">
            <input
              type="text"
              name={`pontosFocais[${idx}][nome]`}
              placeholder="Nome"
              value={p.nome}
              onChange={(ev) => atualizar(idx, { nome: ev.target.value })}
              className="col-span-3 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="email"
              name={`pontosFocais[${idx}][email]`}
              placeholder="E-mail"
              value={p.email}
              onChange={(ev) => atualizar(idx, { email: ev.target.value })}
              className="col-span-3 rounded-md px-3 py-2 text-sm"
            />
            <input
              type="text"
              name={`pontosFocais[${idx}][telefone]`}
              placeholder="Telefone"
              value={p.telefone}
              onChange={(ev) => atualizar(idx, { telefone: ev.target.value })}
              className="col-span-2 rounded-md px-3 py-2 text-sm"
            />
            <select
              name={`pontosFocais[${idx}][funcao]`}
              value={p.funcao}
              onChange={(ev) => atualizar(idx, { funcao: ev.target.value })}
              className="col-span-3 rounded-md px-3 py-2 text-sm"
            >
              <option value="">— Função —</option>
              {OPCOES_FUNCAO_PONTO_FOCAL.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remover(idx)}
              disabled={pessoas.length <= 1}
              className="col-span-1 grid place-items-center rounded-md disabled:opacity-30"
              style={{ color: "var(--text-mute)" }}
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {/* Quando função = OUTRO, mostra campo de descrição livre */}
          {p.funcao === "OUTRO" && (
            <div className="mt-3">
              <input
                type="text"
                name={`pontosFocais[${idx}][funcaoDescricao]`}
                placeholder="Especifique a função (ex: Coordenador técnico)"
                value={p.funcaoDescricao}
                onChange={(ev) => atualizar(idx, { funcaoDescricao: ev.target.value })}
                className="w-full rounded-md px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={adicionar}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
        style={{
          background: "rgba(255,255,255,0.8)",
          color: "var(--text-soft)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar pessoa
      </button>
    </div>
  );
}
