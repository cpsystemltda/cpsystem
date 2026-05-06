"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import {
  detectarBandeira,
  mascararNumero,
  mascararValidade,
  passaLuhn,
  tamanhoCvv,
  tamanhoEsperado,
  type Bandeira,
} from "@/lib/cartao";

const ROTULOS_BANDEIRA: Record<Bandeira, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  AMEX: "American Express",
  ELO: "Elo",
  HIPERCARD: "Hipercard",
  DINERS: "Diners Club",
  DISCOVER: "Discover",
  JCB: "JCB",
  DESCONHECIDA: "—",
};

type Props = {
  defaultNumero?: string;
  defaultValidade?: string;
  defaultNome?: string;
  erros?: {
    cartaoNumero?: string;
    cartaoValidade?: string;
    cartaoCvv?: string;
    cartaoNome?: string;
  };
};

/**
 * Bloco de cartão com máscara, detecção de bandeira em tempo real
 * e feedback visual de validade Luhn. Os 3 inputs são name="cartaoX"
 * pra serem submetidos junto com o resto do formulário.
 */
export function CampoCartao({ defaultNumero = "", defaultValidade = "", defaultNome = "", erros = {} }: Props) {
  const [numero, setNumero] = useState(mascararNumero(defaultNumero));
  const [validade, setValidade] = useState(mascararValidade(defaultValidade));
  const numeroLimpo = numero.replace(/\D/g, "");
  const bandeira = detectarBandeira(numeroLimpo);
  const tamanhoOk = tamanhoEsperado(bandeira).includes(numeroLimpo.length);
  const luhnOk = tamanhoOk && passaLuhn(numeroLimpo);
  const cvvLen = tamanhoCvv(bandeira);

  useEffect(() => {
    setNumero(mascararNumero(defaultNumero));
  }, [defaultNumero]);
  useEffect(() => {
    setValidade(mascararValidade(defaultValidade));
  }, [defaultValidade]);

  return (
    <div className="col-span-4 grid grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5">
      <div className="col-span-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CreditCard className="h-4 w-4 text-slate-500" />
          Cartão de crédito
        </h3>
        <div className="text-xs text-slate-500">
          {bandeira !== "DESCONHECIDA" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              {ROTULOS_BANDEIRA[bandeira]}
            </span>
          ) : (
            "Bandeira detectada automaticamente"
          )}
        </div>
      </div>

      {/* Número */}
      <label className="col-span-4 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Número do cartão</span>
        <div className="relative">
          <input
            type="text"
            name="cartaoNumero"
            value={numero}
            onChange={(e) => setNumero(mascararNumero(e.target.value))}
            placeholder="0000 0000 0000 0000"
            inputMode="numeric"
            autoComplete="cc-number"
            required
            className={`w-full rounded-md border bg-white px-3 py-2 pr-9 text-sm tracking-wider text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
              erros.cartaoNumero ? "border-red-400" : "border-slate-300 focus:border-blue-500"
            }`}
          />
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            {numeroLimpo.length >= 12 &&
              (luhnOk ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              ))}
          </div>
        </div>
        {erros.cartaoNumero ? (
          <span className="text-xs text-red-600">{erros.cartaoNumero}</span>
        ) : numeroLimpo.length >= 12 && !luhnOk ? (
          <span className="text-xs text-amber-700">Esse número não passa na verificação — confira</span>
        ) : null}
      </label>

      {/* Nome impresso */}
      <label className="col-span-4 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Nome impresso (como está no cartão)</span>
        <input
          type="text"
          name="cartaoNome"
          defaultValue={defaultNome}
          placeholder="IGOR DA SILVA FERNANDES"
          autoComplete="cc-name"
          required
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm uppercase text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
            erros.cartaoNome ? "border-red-400" : "border-slate-300 focus:border-blue-500"
          }`}
        />
        {erros.cartaoNome && <span className="text-xs text-red-600">{erros.cartaoNome}</span>}
      </label>

      {/* Validade + CVV */}
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">Validade (MM/AA)</span>
        <input
          type="text"
          name="cartaoValidade"
          value={validade}
          onChange={(e) => setValidade(mascararValidade(e.target.value))}
          placeholder="MM/AA"
          inputMode="numeric"
          autoComplete="cc-exp"
          required
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
            erros.cartaoValidade ? "border-red-400" : "border-slate-300 focus:border-blue-500"
          }`}
        />
        {erros.cartaoValidade && <span className="text-xs text-red-600">{erros.cartaoValidade}</span>}
      </label>
      <label className="col-span-2 flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-700">
          CVV {bandeira !== "DESCONHECIDA" && <span className="font-normal text-slate-400">({cvvLen} dígitos)</span>}
        </span>
        <input
          type="text"
          name="cartaoCvv"
          placeholder={cvvLen === 4 ? "0000" : "000"}
          inputMode="numeric"
          autoComplete="cc-csc"
          required
          maxLength={4}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-200 ${
            erros.cartaoCvv ? "border-red-400" : "border-slate-300 focus:border-blue-500"
          }`}
        />
        {erros.cartaoCvv && <span className="text-xs text-red-600">{erros.cartaoCvv}</span>}
      </label>

      <p className="col-span-4 -mt-1 text-[11px] text-slate-500">
        🔒 Cartão validado e armazenado de forma segura. Cobrança só após o trial de 14 dias —
        nada é debitado agora. Você pode trocar ou cancelar a qualquer momento.
      </p>
    </div>
  );
}
