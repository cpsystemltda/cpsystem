"use client";

import { CalendarClock, TrendingUp, TrendingDown, Wallet, FileCheck } from "lucide-react";
import { brl } from "@/lib/validators";
import type { SaldoAta, SaldoContrato } from "@/lib/saldo";

// KPIs no topo da página de Contrato/Ata — mostra o saldo da vigência
// atual em 3 cards (sempre) e, quando há >1 vigência, mais 2 cards de
// acumulado (todas as vigências). Substitui os 3 cards antigos que
// mostravam só saldo.valorTotal etc. (que já eram da vigência atual
// pós-Phase 2, mas sem o rótulo deixando isso claro).
//
// Usado no header de /contratos/[id] e /atas/[id] — NÃO mais dentro da
// aba Saldo (decisão Regina: KPIs ficam no topo, aba Saldo mostra
// tabelas empilhadas por vigência).

export function KpisSaldoVigencia({ saldo }: { saldo: SaldoAta | SaldoContrato }) {
  const vig = saldo.vigenciaAtual;
  const temMultiplas = saldo.vigencias.length > 1;

  // Fallback pra documentos sem vigência (não deveria acontecer pós-backfill)
  if (!vig) {
    return (
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat titulo="Valor total contratado" valor={brl(saldo.valorTotal)} />
        <Stat
          titulo="Já executado"
          valor={brl(saldo.valorUsado)}
          sub={`${saldo.percentualUsado.toFixed(1)}%`}
        />
        <Stat titulo="A executar" valor={brl(saldo.valorDisponivel)} cor="emerald" />
      </div>
    );
  }

  const sufixoVig = temMultiplas ? ` (${vig.ordem}ª vigência)` : "";

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          titulo={`Valor total contratado${sufixoVig}`}
          valor={brl(vig.valorTotal)}
          icone={CalendarClock}
        />
        <Stat
          titulo={`Já executado${sufixoVig}`}
          valor={brl(vig.valorUsado)}
          sub={`${vig.percentualUsado.toFixed(1)}%`}
          icone={TrendingUp}
        />
        <Stat
          titulo={`A executar${sufixoVig}`}
          valor={brl(vig.valorDisponivel)}
          cor="emerald"
          icone={TrendingDown}
        />
      </div>

      {temMultiplas && (
        <div className="grid gap-4 md:grid-cols-2">
          <Stat
            titulo={`Valor total contratado (todas as ${saldo.vigencias.length} vigências)`}
            valor={brl(saldo.acumulado.valorTotal)}
            cor="indigo"
            icone={Wallet}
          />
          <Stat
            titulo="Já executado (todas as vigências)"
            valor={brl(saldo.acumulado.valorUsado)}
            sub={`R$ ${saldo.acumulado.valorDisponivel.toFixed(2)} restante`}
            cor="amber"
            icone={FileCheck}
          />
        </div>
      )}
    </div>
  );
}

// Mesma assinatura do Stat existente no page.tsx — copiada pra encapsular
// o componente sem dependência cruzada.
function Stat({
  titulo,
  valor,
  sub,
  cor,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  cor?: "emerald" | "indigo" | "amber";
  icone?: React.ElementType;
}) {
  const tones = {
    default: { val: "var(--text)", bg: undefined, border: undefined },
    emerald: { val: "#047857", bg: undefined, border: undefined },
    indigo: { val: "#4338ca", bg: "rgba(99,102,241,0.04)", border: "rgba(99,102,241,0.18)" },
    amber: { val: "#92400e", bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.18)" },
  } as const;
  const tone = cor ? tones[cor] : tones.default;
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white px-5 py-4"
      style={
        tone.bg
          ? { background: tone.bg, borderColor: tone.border ?? "var(--hairline)" }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {titulo}
        </p>
        {Icone && <Icone className="h-4 w-4 shrink-0 text-slate-400" />}
      </div>
      <p
        className="mt-2 text-2xl font-extrabold leading-tight"
        style={{ color: tone.val }}
      >
        {valor}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
