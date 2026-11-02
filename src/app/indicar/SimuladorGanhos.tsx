"use client";

import { useState } from "react";

const POR_EMPRESA = 29.9;

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * "Quantas empresas você conhece que vendem para o governo?" — a conta que a
 * pessoa faz de cabeça, feita na tela. O número que convence não é o R$ 29,90:
 * é o acumulado do ano com dez empresas.
 */
export function SimuladorGanhos() {
  const [n, setN] = useState(5);
  const mes = n * POR_EMPRESA;
  return (
    <div className="rounded-[24px] border border-[#E8D9A8] bg-white/80 p-6 shadow-sm backdrop-blur">
      <label className="block text-[13px] font-semibold text-[#2D3340]">
        Quantas empresas você conhece que vendem para o governo?
      </label>
      <div className="mt-3 flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={50}
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          className="w-full accent-[#B8860B]"
          aria-label="Quantidade de empresas"
        />
        <span className="w-12 text-right font-mono text-xl font-extrabold text-[#9C7A2D]">{n}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Numero rotulo="Por mês" valor={brl(mes)} />
        <Numero rotulo="Por ano" valor={brl(mes * 12)} destaque />
        <Numero rotulo="Em 3 anos" valor={brl(mes * 36)} />
      </div>
      <p className="mt-3 text-[12px] text-[#5D6470]">
        Considerando que todas assinem e continuem clientes. A comissão é por empresa que paga, enquanto ela pagar.
      </p>
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${destaque ? "bg-gradient-to-br from-[#B8860B] to-[#D4AF37] text-white" : "bg-[#FAF6EC] text-[#2D3340]"}`}>
      <p className={`text-[10.5px] font-bold uppercase tracking-[0.18em] ${destaque ? "text-white/80" : "text-[#9C7A2D]"}`}>{rotulo}</p>
      <p className="mt-1 text-[22px] font-extrabold tabular-nums">{valor}</p>
    </div>
  );
}
