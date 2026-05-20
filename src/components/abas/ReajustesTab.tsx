"use client";

/**
 * ReajustesTab — M3 v2
 *
 * Aba de CONSOLIDAÇÃO (read-only). O reajuste de preços é cadastrado via:
 *   1. Termo Aditivo (aba "Aditivos") com bloco "Reajuste?" marcado
 *   2. Apostilamento (aba "Apostilamentos") com bloco "Reajuste?" marcado
 *
 * Esta aba lista tudo o que foi efetivamente aplicado, somando:
 *   - Aditivos com aplicaReajuste=true
 *   - Apostilamentos com aplicaReajuste=true
 *   - Registros legados do model Reajuste (cadastros antigos, antes do M3)
 *
 * Inclui alerta de prazo pra solicitação de reajuste no topo.
 */

import { AlertaReajuste } from "@/components/AlertaReajuste";
import { Info, FileText, TrendingUp } from "lucide-react";

type ReajusteLegado = {
  id: string;
  dataPedido: Date;
  dataAprovacao: Date | null;
  indice: string;
  percentual: number;
  valorAnterior: number;
  valorNovo: number;
  instrumento: string;
  instrumentoNumero: string | null;
  observacoes: string | null;
};

type AditivoComReajuste = {
  id: string;
  numero: string;
  dataAssinatura: Date;
  reajusteIndice: string | null;
  reajusteIndiceOutro: string | null;
  reajustePercentual: number | null;
  reajustePeriodoInicio: Date | null;
  reajustePeriodoFim: Date | null;
  arquivoPdfUrl: string | null;
};

type ApostilamentoComReajuste = AditivoComReajuste;

type LinhaConsolidada = {
  id: string;
  origem: "ADITIVO" | "APOSTILAMENTO" | "LEGADO";
  numero: string;
  data: Date;
  indice: string;
  percentual: number;
  periodoInicio: Date | null;
  periodoFim: Date | null;
  observacoes: string | null;
  arquivoPdfUrl: string | null;
};

const ROTULO_INDICE: Record<string, string> = {
  IPCA: "IPCA",
  IPCA_E: "IPCA-E",
  IPCA_15: "IPCA-15",
  IGPM: "IGP-M",
  INCC: "INCC",
  INPC: "INPC",
  IST: "IST",
  CONTRATUAL: "Contratual",
  OUTRO: "Outro",
};

function rotuloIndice(indice: string | null, outro?: string | null): string {
  if (!indice) return "—";
  if (indice === "OUTRO" && outro) return outro;
  return ROTULO_INDICE[indice] ?? indice;
}

export function ReajustesTab({
  reajustesLegado,
  aditivosComReajuste,
  apostilamentosComReajuste,
  marcoOrcamentoEstimado,
}: {
  reajustesLegado: ReajusteLegado[];
  aditivosComReajuste: AditivoComReajuste[];
  apostilamentosComReajuste: ApostilamentoComReajuste[];
  marcoOrcamentoEstimado?: Date | null;
}) {
  // Consolida tudo em uma lista única, ordenada por data desc
  const linhas: LinhaConsolidada[] = [
    ...aditivosComReajuste
      .filter((a) => a.reajustePercentual != null)
      .map((a) => ({
        id: `adit-${a.id}`,
        origem: "ADITIVO" as const,
        numero: a.numero,
        data: a.dataAssinatura,
        indice: rotuloIndice(a.reajusteIndice, a.reajusteIndiceOutro),
        percentual: a.reajustePercentual ?? 0,
        periodoInicio: a.reajustePeriodoInicio,
        periodoFim: a.reajustePeriodoFim,
        observacoes: null,
        arquivoPdfUrl: a.arquivoPdfUrl,
      })),
    ...apostilamentosComReajuste
      .filter((a) => a.reajustePercentual != null)
      .map((a) => ({
        id: `apos-${a.id}`,
        origem: "APOSTILAMENTO" as const,
        numero: a.numero,
        data: a.dataAssinatura,
        indice: rotuloIndice(a.reajusteIndice, a.reajusteIndiceOutro),
        percentual: a.reajustePercentual ?? 0,
        periodoInicio: a.reajustePeriodoInicio,
        periodoFim: a.reajustePeriodoFim,
        observacoes: null,
        arquivoPdfUrl: a.arquivoPdfUrl,
      })),
    ...reajustesLegado.map((r) => ({
      id: `leg-${r.id}`,
      origem: "LEGADO" as const,
      numero: r.instrumentoNumero ?? "—",
      data: r.dataAprovacao ?? r.dataPedido,
      indice: rotuloIndice(r.indice),
      percentual: r.percentual,
      periodoInicio: null,
      periodoFim: null,
      observacoes: r.observacoes,
      arquivoPdfUrl: null,
    })),
  ].sort((a, b) => b.data.getTime() - a.data.getTime());

  return (
    <div className="space-y-5">
      {/* Banner explicativo */}
      <div
        className="glass-tile flex items-start gap-3 rounded-2xl px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(197,180,255,0.08), rgba(184,197,214,0.04)), var(--glass-1)",
        }}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, var(--lavender), var(--sky))",
            color: "#0A0A0A",
          }}
        >
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p
            className="text-[13px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
          >
            Tela de consolidação — sem cadastro direto
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-soft)" }}>
            Os reajustes são cadastrados nas abas <strong>Aditivos</strong> ou{" "}
            <strong>Apostilamentos</strong>, marcando o bloco <em>&ldquo;Reajuste?&rdquo;</em>{" "}
            e informando índice, período e percentual. Aqui você acompanha o histórico
            consolidado e o alerta de prazo para solicitar o próximo reajuste.
          </p>
        </div>
      </div>

      {/* Alerta de prazo (≤ 90d ou já cabível) */}
      {marcoOrcamentoEstimado && (
        <AlertaReajuste marcoOrcamentoEstimado={marcoOrcamentoEstimado} hrefReajustes="" />
      )}

      {/* Tabela consolidada */}
      {linhas.length === 0 ? (
        <div
          className="glass-tile rounded-2xl px-6 py-8 text-center"
          style={{ color: "var(--text-mute)" }}
        >
          <TrendingUp className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-2 text-[13px]">Nenhum reajuste registrado até o momento.</p>
        </div>
      ) : (
        <div
          className="glass-tile overflow-hidden rounded-[20px]"
          style={{ background: "var(--glass-2)" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr
                className="text-[10px] font-bold uppercase"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--text-mute)",
                  borderBottom: "0.5px solid var(--border-soft)",
                }}
              >
                <th className="px-4 py-3 text-left">Origem</th>
                <th className="px-4 py-3 text-left">Nº</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Índice</th>
                <th className="px-4 py-3 text-right">Percentual</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-center">PDF</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.id}
                  className="transition hover:bg-[var(--glass-1)]"
                  style={{ borderBottom: "0.5px solid var(--border-soft)" }}
                >
                  <td className="px-4 py-3">
                    <PillOrigem origem={l.origem} />
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>
                    {l.numero}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-soft)" }}>
                    {l.data.toLocaleDateString("pt-BR")}
                  </td>
                  <td
                    className="px-4 py-3 font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {l.indice}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-bold tabular-nums"
                    style={{ color: "var(--primary-deep)" }}
                  >
                    {l.percentual.toFixed(4).replace(".", ",")}%
                  </td>
                  <td
                    className="px-4 py-3 text-[12px]"
                    style={{ color: "var(--text-mute)" }}
                  >
                    {l.periodoInicio && l.periodoFim
                      ? `${l.periodoInicio.toLocaleDateString("pt-BR")} → ${l.periodoFim.toLocaleDateString("pt-BR")}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {l.arquivoPdfUrl ? (
                      <a
                        href={l.arquivoPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold underline"
                        style={{ color: "var(--sky-deep, #3F638F)" }}
                      >
                        <FileText className="h-3 w-3" /> PDF
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-mute)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Resumo: valor a aplicar é multiplicativo */}
          <ResumoConsolidado linhas={linhas} />
        </div>
      )}

      {/* Observações de legado (quando houver) */}
      {linhas.some((l) => l.observacoes) && (
        <div className="space-y-2">
          {linhas
            .filter((l) => l.observacoes)
            .map((l) => (
              <p
                key={l.id}
                className="text-[12px] italic"
                style={{ color: "var(--text-mute)" }}
              >
                <strong>{l.numero}:</strong> {l.observacoes}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function PillOrigem({ origem }: { origem: "ADITIVO" | "APOSTILAMENTO" | "LEGADO" }) {
  const conf = {
    ADITIVO: { bg: "rgba(212,175,55,0.18)", fg: "var(--primary-deep)", texto: "Aditivo" },
    APOSTILAMENTO: { bg: "rgba(63,99,143,0.14)", fg: "var(--sky-deep, #3F638F)", texto: "Apostilamento" },
    LEGADO: { bg: "rgba(127,127,127,0.14)", fg: "var(--text-mute)", texto: "Legado" },
  }[origem];
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase"
      style={{ background: conf.bg, color: conf.fg, letterSpacing: "0.08em" }}
    >
      {conf.texto}
    </span>
  );
}

function ResumoConsolidado({ linhas }: { linhas: LinhaConsolidada[] }) {
  if (linhas.length === 0) return null;
  // Acumulado multiplicativo: (1 + p1) * (1 + p2) * ... - 1
  const acumulado = linhas.reduce((acc, l) => acc * (1 + l.percentual / 100), 1) - 1;
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ background: "var(--glass-1)", borderTop: "0.5px solid var(--border-soft)" }}
    >
      <span
        className="text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.14em", color: "var(--text-mute)" }}
      >
        Total acumulado de reajustes
      </span>
      <span
        className="text-[15px] font-extrabold tabular-nums"
        style={{ color: "var(--primary-deep)" }}
      >
        {(acumulado * 100).toFixed(4).replace(".", ",")}%
      </span>
    </div>
  );
}

