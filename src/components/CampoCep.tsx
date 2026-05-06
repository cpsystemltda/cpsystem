"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function mascararCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function setarCampo(name: string, valor: string) {
  const el = document.querySelector<HTMLInputElement>(`[name="${name}"]`);
  if (!el) return;
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

type Props = {
  defaultValue?: string;
  erro?: string;
  name?: string;
  label?: string;
  required?: boolean;
  /** Nome do campo de endereço a preencher. Default "endereco". */
  campoEndereco?: string;
  /** col-span (1..4). Default 2. */
  span?: 1 | 2 | 3 | 4;
};

/**
 * Campo CEP com máscara + autopreenchimento de endereço via BrasilAPI.
 * Após 8 dígitos, busca CEP e preenche o campo de endereço (mantendo
 * número/complemento pendentes pro usuário).
 */
export function CampoCep({
  defaultValue = "",
  erro,
  name = "cep",
  label = "CEP",
  required = true,
  campoEndereco = "endereco",
  span = 2,
}: Props) {
  const [valor, setValor] = useState(mascararCep(defaultValue));
  const [estado, setEstado] = useState<"idle" | "buscando" | "ok" | "erro">("idle");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const ultimoBuscado = useRef<string>("");

  const spanCls =
    span === 1 ? "col-span-1" : span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "col-span-4";

  useEffect(() => {
    setValor(mascararCep(defaultValue));
  }, [defaultValue]);

  async function buscarCep(cepLimpo: string) {
    if (cepLimpo.length !== 8 || cepLimpo === ultimoBuscado.current) return;
    ultimoBuscado.current = cepLimpo;
    setEstado("buscando");
    setMensagem(null);
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);
      if (!r.ok) {
        setEstado("erro");
        setMensagem(r.status === 404 ? "CEP não encontrado" : "Erro ao consultar CEP");
        return;
      }
      const d = await r.json();
      const partes = [d.street, d.neighborhood, d.city && d.state ? `${d.city}/${d.state}` : null]
        .filter(Boolean)
        .join(", ");
      if (partes) {
        const atual = document.querySelector<HTMLInputElement>(`[name="${campoEndereco}"]`)?.value ?? "";
        // Só substitui se o campo estiver vazio ou for diferente
        if (!atual || atual.length < partes.length) setarCampo(campoEndereco, partes);
      }
      setEstado("ok");
      setMensagem("Endereço preenchido — adicione número e complemento");
    } catch {
      setEstado("erro");
      setMensagem("Sem conexão com a base de CEPs");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novo = mascararCep(e.target.value);
    setValor(novo);
    const limpo = novo.replace(/\D/g, "");
    if (limpo.length === 8) buscarCep(limpo);
    else if (estado !== "idle") {
      setEstado("idle");
      setMensagem(null);
    }
  }

  return (
    <label className={`flex flex-col gap-1 ${spanCls}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="text"
          name={name}
          value={valor}
          onChange={handleChange}
          required={required}
          placeholder="00000-000"
          inputMode="numeric"
          autoComplete="postal-code"
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
