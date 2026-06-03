"use client";

import { useState } from "react";
import { CalendarClock, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { brl } from "@/lib/validators";
import type { SaldoAta, SaldoContrato } from "@/lib/saldo";

// KPIs no topo da página de Contrato/Ata.
// Regina (03/06): aplicar a mesma logica Vigentes × Serie historica das
// listagens /contratos e /atas, com Serie historica colapsavel.
//
// Comportamento:
// - Sempre mostra 3 caixinhas "Vigentes" (vigencia atual).
// - Quando ha >1 vigencia, aparece a Serie historica colapsavel
//   (acumulado de todas as vigencias), com setinha que abre/recolhe.
// - Quando ha apenas 1 vigencia, nao mostra a Serie historica
//   (duplicaria os mesmos numeros).

export function KpisSaldoVigencia({ saldo }: { saldo: SaldoAta | SaldoContrato }) {
  const vig = saldo.vigenciaAtual;
  const temMultiplas = saldo.vigencias.length > 1;

  // Fallback pra documentos sem vigencia (nao deveria acontecer pos-backfill)
  if (!vig) {
    return (
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Stat titulo="Valor total contratado" valor={brl(saldo.valorTotal)} icone={CalendarClock} />
        <Stat
          titulo="Já executado"
          valor={brl(saldo.valorUsado)}
          sub={`${saldo.percentualUsado.toFixed(1)}%`}
          icone={TrendingUp}
        />
        <Stat
          titulo="A executar"
          valor={brl(saldo.valorDisponivel)}
          cor="emerald"
          icone={TrendingDown}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Vigente — sempre visivel. Quando ha mais de uma vigencia,
          rotulamos com 'Vigencia atual' pra deixar claro o escopo. */}
      <section>
        {temMultiplas && (
          <header className="mb-2 flex items-baseline gap-3">
            <h3
              className="text-[13px] font-extrabold uppercase"
              style={{ letterSpacing: "0.15em", color: "var(--primary-deep)" }}
            >
              Vigência atual
            </h3>
            <span className="text-xs" style={{ color: "var(--text-soft)" }}>
              {vig.ordem}ª vigência · em curso
            </span>
          </header>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Stat
            titulo="Valor total contratado"
            valor={brl(vig.valorTotal)}
            icone={CalendarClock}
          />
          <Stat
            titulo="Já executado"
            valor={brl(vig.valorUsado)}
            sub={`${vig.percentualUsado.toFixed(1)}%`}
            icone={TrendingUp}
          />
          <Stat
            titulo="A executar"
            valor={brl(vig.valorDisponivel)}
            cor="emerald"
            icone={TrendingDown}
          />
        </div>
      </section>

      {temMultiplas && (
        <SerieHistoricaColapsavel
          total={saldo.acumulado.valorTotal}
          usado={saldo.acumulado.valorUsado}
          disponivel={saldo.acumulado.valorDisponivel}
          qtdVigencias={saldo.vigencias.length}
          percentualUsado={
            saldo.acumulado.valorTotal === 0
              ? 0
              : (saldo.acumulado.valorUsado / saldo.acumulado.valorTotal) * 100
          }
        />
      )}
    </div>
  );
}

function SerieHistoricaColapsavel({
  total,
  usado,
  disponivel,
  qtdVigencias,
  percentualUsado,
}: {
  total: number;
  usado: number;
  disponivel: number;
  qtdVigencias: number;
  percentualUsado: number;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex items-baseline gap-2 w-full text-left"
        aria-expanded={aberto}
      >
        <ChevronDown
          className="h-4 w-4 transition-transform"
          style={{
            transform: aberto ? "rotate(0deg)" : "rotate(-90deg)",
            color: "var(--primary-deep)",
          }}
        />
        <h3
          className="text-[13px] font-extrabold uppercase"
          style={{ letterSpacing: "0.15em", color: "var(--primary-deep)" }}
        >
          Série histórica
        </h3>
        <span className="text-xs" style={{ color: "var(--text-soft)" }}>
          Soma das {qtdVigencias} vigências
          {!aberto && " · clique pra expandir"}
        </span>
      </button>
      {aberto && (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Stat
            titulo="Valor total contratado"
            valor={brl(total)}
            icone={CalendarClock}
            cor="indigo"
          />
          <Stat
            titulo="Já executado"
            valor={brl(usado)}
            sub={`${percentualUsado.toFixed(1)}%`}
            icone={TrendingUp}
            cor="amber"
          />
          <Stat
            titulo="A executar"
            valor={brl(disponivel)}
            icone={TrendingDown}
            cor="emerald"
          />
        </div>
      )}
    </section>
  );
}

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
