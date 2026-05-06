"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Máscara CNPJ: 00.000.000/0000-00
function mascararCnpj(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Mapeia porte da Receita pra enum interno (MEI/ME/EPP/GRANDE).
function mapearPorte(porte: string | undefined): string | null {
  const p = (porte ?? "").toUpperCase();
  if (p.includes("MEI")) return "MEI";
  if (p.includes("MICRO")) return "ME";
  if (p.includes("PEQUENO")) return "EPP";
  if (p.includes("DEMAIS") || p.includes("GRANDE")) return "GRANDE";
  return null;
}

function setarCampo(name: string, valor: string) {
  const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  if (!el) return;
  // Define valor + dispara evento pra que React/forms percebam (inputs descontrolados)
  const proto =
    el instanceof HTMLSelectElement
      ? Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")
      : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

type Props = {
  defaultValue?: string;
  erro?: string;
  name?: string; // permite reusar com nome de input diferente
  label?: string;
  required?: boolean;
  /** Quando true, autopreenche campos da empresa (razão, porte, etc). Default true. */
  autopreencher?: boolean;
};

/**
 * Campo CNPJ com máscara automática + autopreenchimento via BrasilAPI.
 * Quando o usuário termina de digitar 14 dígitos, busca dados da Receita
 * e preenche os outros campos do formulário (razão, porte, natureza, endereço…).
 */
export function CampoCnpj({
  defaultValue = "",
  erro,
  name = "cnpj",
  label = "CNPJ",
  required = true,
  autopreencher = true,
}: Props) {
  const [valor, setValor] = useState(mascararCnpj(defaultValue));
  const [estado, setEstado] = useState<"idle" | "buscando" | "ok" | "erro">("idle");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const ultimoBuscado = useRef<string>("");

  useEffect(() => {
    setValor(mascararCnpj(defaultValue));
  }, [defaultValue]);

  async function buscarReceita(cnpjLimpo: string) {
    if (!autopreencher || cnpjLimpo.length !== 14 || cnpjLimpo === ultimoBuscado.current) return;
    ultimoBuscado.current = cnpjLimpo;
    setEstado("buscando");
    setMensagem(null);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!r.ok) {
        setEstado("erro");
        setMensagem(r.status === 404 ? "CNPJ não encontrado na Receita" : "Erro ao consultar a Receita");
        return;
      }
      const d = await r.json();
      // Preenche os demais campos
      if (d.razao_social) setarCampo("razaoSocial", d.razao_social);
      if (d.nome_fantasia) setarCampo("nomeFantasia", d.nome_fantasia);
      const porte = mapearPorte(d.porte);
      if (porte) setarCampo("porte", porte);
      if (d.cnae_fiscal_descricao) setarCampo("cnaePrincipal", `${d.cnae_fiscal} — ${d.cnae_fiscal_descricao}`);
      if (d.cep) setarCampo("cep", String(d.cep).replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2"));
      const enderecoCompleto = [
        d.descricao_tipo_de_logradouro,
        d.logradouro,
        d.numero ? `nº ${d.numero}` : null,
        d.bairro,
        d.municipio && d.uf ? `${d.municipio}/${d.uf}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      if (enderecoCompleto) setarCampo("endereco", enderecoCompleto);
      if (d.complemento) setarCampo("complemento", d.complemento);
      if (d.email && !document.querySelector<HTMLInputElement>(`[name="emailEmpresa"]`)?.value) {
        setarCampo("emailEmpresa", d.email);
      }
      if (d.ddd_telefone_1 && !document.querySelector<HTMLInputElement>(`[name="telefones"]`)?.value) {
        setarCampo("telefones", d.ddd_telefone_1);
      }
      setEstado("ok");
      setMensagem("Dados da Receita preenchidos automaticamente — confira");
    } catch {
      setEstado("erro");
      setMensagem("Sem conexão com a Receita. Preencha manualmente.");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novo = mascararCnpj(e.target.value);
    setValor(novo);
    const limpo = novo.replace(/\D/g, "");
    if (limpo.length === 14) buscarReceita(limpo);
    else if (estado !== "idle") {
      setEstado("idle");
      setMensagem(null);
    }
  }

  return (
    <label className="col-span-2 flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="text"
          name={name}
          value={valor}
          onChange={handleChange}
          required={required}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          autoComplete="off"
          className={`w-full rounded-md border bg-white px-3 py-2 pr-9 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
            erro ? "border-red-400 focus:border-red-400" : "border-slate-300 focus:border-blue-500"
          }`}
        />
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          {estado === "buscando" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          {estado === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {estado === "erro" && <AlertCircle className="h-4 w-4 text-amber-500" />}
        </div>
      </div>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
      {!erro && mensagem && (
        <span className={`text-xs ${estado === "ok" ? "text-emerald-700" : "text-amber-700"}`}>{mensagem}</span>
      )}
    </label>
  );
}
