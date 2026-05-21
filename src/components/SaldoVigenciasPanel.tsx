"use client";

import { useState } from "react";
import { CalendarClock, TrendingUp, TrendingDown, Wallet, FileCheck } from "lucide-react";
import { brl } from "@/lib/validators";
import type {
  SaldoAta,
  SaldoContrato,
  SaldoVigencia,
  SaldoVigenciaContrato,
} from "@/lib/saldo";

// Painel da aba "Saldo de itens" reescrito pra mostrar saldo por vigência.
// Mesma estrutura pra Contrato e Ata — o callsite passa o tipo certo de
// itens via prop `renderTabela`.
//
// Layout:
//   1. 5 KPIs no topo (3 vigência atual + 2 acumulado, esses só quando >1 vig)
//   2. Seletor de vigências em chips (só quando >1 vig)
//   3. Tabela de itens da vigência selecionada (callsite renderiza)
//   4. Histórico de vigências em tabela cronológica (só quando >1 vig)

// Renderer recebe `unknown[]` pra evitar conflito entre os tipos de
// SaldoItem (Ata, com ataItemId) e SaldoItemContrato (com contratoItemId).
// O callsite faz cast pro tipo certo (ItensAtaTab espera ataItemId,
// ItensContratoTab espera contratoItemId).
export function SaldoVigenciasPanel({
  saldo,
  renderTabela,
}: {
  saldo: SaldoAta | SaldoContrato;
  renderTabela: (itens: unknown[]) => React.ReactNode;
}) {
  const [vigenciaSelecionadaId, setVigenciaSelecionadaId] = useState<string | null>(
    saldo.vigenciaAtual?.vigenciaId ?? null,
  );

  const vigViewing =
    saldo.vigencias.find((v) => v.vigenciaId === vigenciaSelecionadaId) ??
    saldo.vigenciaAtual ??
    saldo.vigencias[0] ??
    null;

  const temMultiplasVigencias = saldo.vigencias.length > 1;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      {saldo.vigenciaAtual && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiCard
            tone="violet"
            icon={CalendarClock}
            label={`Valor contratado (Vigência ${saldo.vigenciaAtual.ordem}ª)`}
            value={brl(saldo.vigenciaAtual.valorTotal)}
            sub={`${formatarData(saldo.vigenciaAtual.dataInicio)} → ${formatarData(saldo.vigenciaAtual.dataFim)}`}
          />
          <KpiCard
            tone="rose"
            icon={TrendingUp}
            label="Já executado (vigência atual)"
            value={brl(saldo.vigenciaAtual.valorUsado)}
            sub={`${saldo.vigenciaAtual.percentualUsado.toFixed(1)}% executado`}
          />
          <KpiCard
            tone="emerald"
            icon={TrendingDown}
            label="A executar (vigência atual)"
            value={brl(saldo.vigenciaAtual.valorDisponivel)}
            sub={
              saldo.vigenciaAtual.status === "ENCERRADA"
                ? "Vigência encerrada"
                : "Saldo disponível"
            }
          />
        </div>
      )}

      {/* 2 cards adicionais quando há >1 vigência */}
      {temMultiplasVigencias && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <KpiCard
            tone="indigo"
            icon={Wallet}
            label={`Valor total (todas as ${saldo.vigencias.length} vigências)`}
            value={brl(saldo.acumulado.valorTotal)}
            sub="Soma cumulativa entre vigências"
          />
          <KpiCard
            tone="amber"
            icon={FileCheck}
            label="Já executado (todas as vigências)"
            value={brl(saldo.acumulado.valorUsado)}
            sub={`R$ ${saldo.acumulado.valorDisponivel.toFixed(2)} restante`}
          />
        </div>
      )}

      {/* Seletor de vigências (chips) — só quando >1 */}
      {temMultiplasVigencias && (
        <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-500">
            Vigência:
          </span>
          <div className="flex gap-1.5">
            {saldo.vigencias.map((v) => {
              const sel = v.vigenciaId === vigenciaSelecionadaId;
              return (
                <button
                  key={v.vigenciaId}
                  type="button"
                  onClick={() => setVigenciaSelecionadaId(v.vigenciaId)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition"
                  style={{
                    background: sel ? "var(--primary-deep)" : "white",
                    color: sel ? "white" : "var(--text)",
                    border: sel
                      ? "1px solid var(--primary-deep)"
                      : "1px solid var(--hairline)",
                  }}
                  title={`${formatarData(v.dataInicio)} → ${formatarData(v.dataFim)}`}
                >
                  {v.ordem}ª
                  <StatusBadge status={v.status} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela de itens da vigência selecionada */}
      <div>
        {temMultiplasVigencias && vigViewing && (
          <p className="mb-2 text-xs text-slate-500">
            Mostrando itens da <strong>{vigViewing.ordem}ª vigência</strong> (
            {formatarData(vigViewing.dataInicio)} →{" "}
            {formatarData(vigViewing.dataFim)})
          </p>
        )}
        {renderTabela(vigViewing?.itens ?? [])}
      </div>

      {/* Histórico de vigências (só quando >1) */}
      {temMultiplasVigencias && (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Histórico de vigências
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Período</th>
                  <th className="px-4 py-2 text-right">Valor total</th>
                  <th className="px-4 py-2 text-right">Executado</th>
                  <th className="px-4 py-2 text-right">% usado</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-left">Origem</th>
                </tr>
              </thead>
              <tbody>
                {saldo.vigencias.map((v) => (
                  <tr key={v.vigenciaId} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-bold">{v.ordem}ª</td>
                    <td className="px-4 py-2 text-slate-600">
                      {formatarData(v.dataInicio)} → {formatarData(v.dataFim)}
                    </td>
                    <td className="px-4 py-2 text-right">{brl(v.valorTotal)}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {brl(v.valorUsado)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {v.percentualUsado.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusBadge status={v.status} grande />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {v.termoAditivoId ? "Termo Aditivo" : "Original"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  tone,
  icon: Icon,
  label,
  value,
  sub,
}: {
  tone: "violet" | "rose" | "emerald" | "indigo" | "amber";
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  const cores = {
    violet: {
      bg: "rgba(124,58,237,0.08)",
      border: "rgba(124,58,237,0.18)",
      ico: "#7c3aed",
    },
    rose: {
      bg: "rgba(244,63,94,0.08)",
      border: "rgba(244,63,94,0.18)",
      ico: "#f43f5e",
    },
    emerald: {
      bg: "rgba(16,185,129,0.08)",
      border: "rgba(16,185,129,0.18)",
      ico: "#10b981",
    },
    indigo: {
      bg: "rgba(99,102,241,0.08)",
      border: "rgba(99,102,241,0.18)",
      ico: "#6366f1",
    },
    amber: {
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.18)",
      ico: "#f59e0b",
    },
  }[tone];

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ background: cores.bg, border: `1px solid ${cores.border}` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: "white" }}
        >
          <Icon className="h-4 w-4" style={{ color: cores.ico }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-extrabold leading-tight" style={{ color: "var(--text)" }}>
            {value}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  grande = false,
}: {
  status: "ATIVA" | "ENCERRADA" | "FUTURA";
  grande?: boolean;
}) {
  const cor = {
    ATIVA: { bg: "rgba(16,185,129,0.18)", txt: "#065f46" },
    ENCERRADA: { bg: "rgba(100,116,139,0.18)", txt: "#475569" },
    FUTURA: { bg: "rgba(245,158,11,0.18)", txt: "#92400e" },
  }[status];
  return (
    <span
      className={`inline-flex items-center rounded-full ${grande ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[9px]"} font-bold uppercase`}
      style={{ background: cor.bg, color: cor.txt }}
    >
      {status === "ATIVA" ? "ativa" : status === "ENCERRADA" ? "encerrada" : "futura"}
    </span>
  );
}

function formatarData(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}
