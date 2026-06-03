"use client";

import { useState } from "react";
import { Coins, TrendingUp, ArrowRight, AlertTriangle, ChevronDown } from "lucide-react";
import { brl } from "@/lib/validators";
import { KPI } from "@/components/ui/KPI";

export type GrupoFinanceiro = {
  contratados: number;
  executados: number;
  aExecutar: number;
  recebidos: number;
  aReceber: number;
  /** Só "Vigentes" mostra. Em "Série histórica" o reajuste não faz sentido (é janela futura). */
  reajusteQtd?: number;
};

type Contexto = "contratos" | "arps";

const ROTULOS: Record<
  Contexto,
  { contratado: string; executado: string; aExecutar: string; reajuste: string; subVigente: string; subHist: string }
> = {
  contratos: {
    contratado: "Contratado em Contratos",
    executado: "Executado em Contratos",
    aExecutar: "A executar em Contratos",
    reajuste: "Contratos em janela de reajuste",
    subVigente: "Apenas Contratos atualmente vigentes",
    subHist: "Todos os Contratos da empresa (vigentes + expirados)",
  },
  arps: {
    contratado: "Contratado em ARPs",
    executado: "Executado em ARPs",
    aExecutar: "A executar em ARPs",
    reajuste: "ARPs em janela de reajuste",
    subVigente: "Apenas ARPs atualmente vigentes",
    subHist: "Todas as ARPs da empresa (vigentes + expiradas)",
  },
};

export function PainelFinanceiroExpansivel({
  contexto,
  vigente,
  historico,
}: {
  contexto: Contexto;
  vigente: GrupoFinanceiro;
  historico: GrupoFinanceiro;
}) {
  const [aberto, setAberto] = useState(false);
  const r = ROTULOS[contexto];

  return (
    <div className="space-y-6">
      {/* Vigentes — sempre visível, no topo. Reajuste só faz sentido aqui. */}
      <section>
        <header className="mb-2 flex items-baseline gap-3">
          <h3
            className="text-[13px] font-extrabold uppercase"
            style={{ letterSpacing: "0.15em", color: "var(--primary-deep)" }}
          >
            Vigentes
          </h3>
          <span className="text-xs" style={{ color: "var(--text-soft)" }}>
            {r.subVigente}
          </span>
        </header>
        <div className="grid gap-3.5 lg:grid-cols-3">
          <KPI tone="lavender" icon={Coins} label={r.contratado} value={brl(vigente.contratados)} meta="Soma do valor — vigentes" />
          <KPI tone="primary" icon={TrendingUp} label={r.executado} value={brl(vigente.executados)} meta="Empenhos vinculados — vigentes" />
          <KPI tone="mint" icon={ArrowRight} label={r.aExecutar} value={brl(vigente.aExecutar)} meta="Contratado − Executado" />
          <KPI tone="mint" icon={Coins} label="Recebido" value={brl(vigente.recebidos)} meta="Empenhos PAGOS vinculados — vigentes" href="/execucao?status=PAGO" />
          <KPI tone="primary" icon={Coins} label="A receber" value={brl(vigente.aReceber)} meta="NF emitida/encaminhada, aguardando pagamento" href="/execucao?status=NF_ENCAMINHADA" />
          {vigente.reajusteQtd !== undefined ? (
            <KPI
              tone="rose"
              icon={AlertTriangle}
              label={r.reajuste}
              value={vigente.reajusteQtd}
              meta="Marco + 12 meses dentro de 90 dias"
              pulse={vigente.reajusteQtd > 0}
              href="/reajustes"
            />
          ) : (
            <div />
          )}
        </div>
      </section>

      {/* Série histórica — colapsável. Setinha gira pra indicar estado. */}
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
            {r.subHist}
            {!aberto && " · clique pra expandir"}
          </span>
        </button>
        {aberto && (
          <div className="mt-3 grid gap-3.5 lg:grid-cols-3">
            <KPI tone="lavender" icon={Coins} label={r.contratado} value={brl(historico.contratados)} meta="Soma do valor — todo o histórico" />
            <KPI tone="primary" icon={TrendingUp} label={r.executado} value={brl(historico.executados)} meta="Empenhos vinculados — todo o histórico" />
            <KPI tone="mint" icon={ArrowRight} label={r.aExecutar} value={brl(historico.aExecutar)} meta="Contratado − Executado" />
            <KPI tone="mint" icon={Coins} label="Recebido" value={brl(historico.recebidos)} meta="Empenhos PAGOS — todo o histórico" href="/execucao?status=PAGO" />
            <KPI tone="primary" icon={Coins} label="A receber" value={brl(historico.aReceber)} meta="NF emitida/encaminhada, aguardando pagamento" href="/execucao?status=NF_ENCAMINHADA" />
            <div />
          </div>
        )}
      </section>
    </div>
  );
}
