"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, FileText, ClipboardList, AlertTriangle } from "lucide-react";

type Item = {
  id: string;
  tipo: "ata" | "contrato";
  numero: string;
  orgaoNome: string;
  vigenciaFim: Date;
};

type FiltroTipo = "TODOS" | "ATA" | "CONTRATO";
type FiltroJanela = 30 | 60 | 90 | 120;

const FAIXA_COR: { ate: number; bg: string; fg: string; label: string }[] = [
  { ate: 30,  bg: "rgba(232,138,152,0.20)", fg: "var(--coral-deep)",   label: "Crítico (≤ 30d)" },
  { ate: 60,  bg: "rgba(245,176,90,0.20)",  fg: "#8a5215",             label: "Próximo (≤ 60d)" },
  { ate: 90,  bg: "rgba(212,175,55,0.22)",  fg: "var(--primary-deep)", label: "Atenção (≤ 90d)" },
  { ate: 120, bg: "rgba(184,197,214,0.20)", fg: "#365175",             label: "Horizonte (≤ 120d)" },
];

function corDeDias(dias: number) {
  for (const f of FAIXA_COR) if (dias <= f.ate) return f;
  return FAIXA_COR[FAIXA_COR.length - 1];
}

/**
 * Timeline horizontal de vencimentos — modo gráfico.
 *
 * Cada Ata/Contrato vira um pino plotado horizontalmente em posição
 * proporcional aos dias até vencer (0 = hoje à esquerda, 120 = direita).
 * Pinos com hover/tooltip e click pra abrir detalhe. Para evitar
 * sobreposição quando há muitos no mesmo dia, distribuímos em "lanes"
 * verticais (até 4 lanes). Filtros discretos no topo.
 */
export function TimelineVencimentos({ itens }: { itens: Item[] }) {
  const [tipo, setTipo] = useState<FiltroTipo>("TODOS");
  const [janela, setJanela] = useState<FiltroJanela>(120);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const itensComDias = useMemo(() => {
    return itens
      .map((i) => {
        const dias = Math.ceil((i.vigenciaFim.getTime() - hoje.getTime()) / 86400000);
        return { ...i, dias };
      })
      .filter((i) => i.dias >= 0 && i.dias <= 120)
      .sort((a, b) => a.dias - b.dias);
  }, [itens, hoje]);

  const filtrados = useMemo(() => {
    return itensComDias.filter((i) => {
      if (tipo === "ATA" && i.tipo !== "ata") return false;
      if (tipo === "CONTRATO" && i.tipo !== "contrato") return false;
      if (i.dias > janela) return false;
      return true;
    });
  }, [itensComDias, tipo, janela]);

  // Lanes: distribui pinos verticalmente quando próximos no eixo X (≤ 4%
  // de distância). Até 4 lanes; itens seguintes empilham na lane 0 de novo.
  const itensPlotados = useMemo(() => {
    const lanes: { pct: number; idx: number }[][] = [[], [], [], []];
    return filtrados.map((item, idx) => {
      const pct = (item.dias / 120) * 100;
      let lane = 0;
      for (let l = 0; l < lanes.length; l++) {
        const last = lanes[l][lanes[l].length - 1];
        if (!last || pct - last.pct > 4) {
          lane = l;
          break;
        }
        lane = (l + 1) % lanes.length;
      }
      lanes[lane].push({ pct, idx });
      return { ...item, pct, lane };
    });
  }, [filtrados]);

  const contagens = useMemo(
    () => ({
      todos: itensComDias.length,
      ata: itensComDias.filter((i) => i.tipo === "ata").length,
      contrato: itensComDias.filter((i) => i.tipo === "contrato").length,
      d30: itensComDias.filter((i) => i.dias <= 30).length,
    }),
    [itensComDias],
  );

  return (
    <section className="glass overflow-hidden rounded-[20px] px-5 py-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Vencimentos próximos
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
            Atas e Contratos em janela de até {janela} dias. Passe o mouse sobre um marcador.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented control: Todos / Atas / Contratos */}
          <div
            className="inline-flex rounded-full p-0.5 text-[11px] font-bold"
            style={{ background: "rgba(15,14,12,0.05)", border: "0.5px solid var(--hairline)" }}
          >
            {([
              { v: "TODOS" as const, label: "Todos", count: contagens.todos },
              { v: "ATA" as const, label: "Atas", count: contagens.ata },
              { v: "CONTRATO" as const, label: "Contratos", count: contagens.contrato },
            ]).map((opt) => {
              const ativo = tipo === opt.v;
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setTipo(opt.v)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition"
                  style={{
                    background: ativo ? "var(--primary-deep)" : "transparent",
                    color: ativo ? "white" : "var(--text-soft)",
                  }}
                >
                  {opt.label}
                  <span
                    className="rounded-full px-1.5 text-[10px]"
                    style={{
                      background: ativo ? "rgba(255,255,255,0.25)" : "rgba(15,14,12,0.08)",
                      color: ativo ? "white" : "var(--text-mute)",
                    }}
                  >
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Dropdown da janela: pequeno, à direita */}
          <select
            value={janela}
            onChange={(ev) => setJanela(Number(ev.currentTarget.value) as FiltroJanela)}
            className="rounded-full px-3 py-1.5 text-[11px] font-bold"
            style={{
              background: "rgba(15,14,12,0.05)",
              border: "0.5px solid var(--hairline)",
              color: "var(--text-soft)",
            }}
          >
            <option value={30}>Janela: ≤ 30 dias</option>
            <option value={60}>Janela: ≤ 60 dias</option>
            <option value={90}>Janela: ≤ 90 dias</option>
            <option value={120}>Janela: ≤ 120 dias</option>
          </select>
        </div>
      </header>

      {itensComDias.length === 0 ? (
        <div
          className="rounded-xl px-6 py-12 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <CalendarClock className="mx-auto h-8 w-8" style={{ color: "var(--text-mute)" }} />
          <p className="mt-3 text-sm font-extrabold" style={{ color: "var(--text)" }}>
            Nenhum vencimento nos próximos 120 dias.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Você está com a carteira folgada. Volte aqui em algumas semanas.
          </p>
        </div>
      ) : (
        <>
          {/* Faixas coloridas de fundo (Crítico/Próximo/Atenção/Horizonte) */}
          <div className="relative" style={{ height: "200px" }}>
            <div className="absolute inset-x-0 top-6 bottom-10 flex overflow-hidden rounded-lg">
              {FAIXA_COR.map((faixa, i) => {
                const prev = i === 0 ? 0 : FAIXA_COR[i - 1].ate;
                const largura = ((faixa.ate - prev) / 120) * 100;
                return (
                  <div
                    key={faixa.label}
                    style={{
                      width: `${largura}%`,
                      background: faixa.bg,
                      borderRight: i < FAIXA_COR.length - 1 ? "0.5px solid rgba(255,255,255,0.4)" : "none",
                    }}
                  />
                );
              })}
            </div>

            {/* Eixo: marcas em 0/30/60/90/120 */}
            <div className="absolute inset-x-0 top-0 h-6">
              {[0, 30, 60, 90, 120].map((d) => {
                const pct = (d / 120) * 100;
                return (
                  <div
                    key={d}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                  >
                    <span
                      className="text-[10px] font-bold tabular uppercase"
                      style={{ color: "var(--text-mute)", letterSpacing: "0.06em" }}
                    >
                      {d === 0 ? "hoje" : `${d}d`}
                    </span>
                    <div className="mt-0.5 h-2 w-px" style={{ background: "var(--text-mute)" }} />
                  </div>
                );
              })}
            </div>

            {/* Pinos plotados em lanes (cada lane = 1/4 da altura útil) */}
            <div className="absolute inset-x-0 top-8 bottom-10">
              {itensPlotados.map((i, idx) => {
                const cor = corDeDias(i.dias);
                const href = i.tipo === "ata" ? `/atas/${i.id}` : `/contratos/${i.id}`;
                const top = i.lane * 28; // 28px entre lanes
                return (
                  <Link
                    key={`${i.tipo}-${i.id}`}
                    href={href}
                    className="absolute inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition hover:scale-110"
                    style={{
                      left: `${i.pct}%`,
                      top: `${top}px`,
                      transform: "translateX(-50%)",
                      background: cor.fg,
                      color: "white",
                      boxShadow: hoverIdx === idx
                        ? `0 6px 14px ${cor.fg}55, 0 0 0 3px white`
                        : `0 2px 6px ${cor.fg}55`,
                      zIndex: hoverIdx === idx ? 10 : 1,
                      whiteSpace: "nowrap",
                    }}
                    title={`${i.tipo === "ata" ? "Ata" : "Contrato"} ${i.numero} · ${i.orgaoNome} · ${i.vigenciaFim.toLocaleDateString("pt-BR")}`}
                    onMouseEnter={() => setHoverIdx(idx)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    {i.tipo === "ata" ? (
                      <FileText className="h-3 w-3" />
                    ) : (
                      <ClipboardList className="h-3 w-3" />
                    )}
                    {i.numero}
                    <span style={{ opacity: 0.8 }}>· {i.dias}d</span>
                  </Link>
                );
              })}
            </div>

            {/* Legenda das faixas, embaixo */}
            <div className="absolute inset-x-0 bottom-0 flex justify-between text-[9px] font-bold uppercase tabular"
              style={{ letterSpacing: "0.08em", color: "var(--text-mute)" }}
            >
              {FAIXA_COR.map((f) => (
                <span key={f.label} style={{ color: f.fg }}>
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          {filtrados.length === 0 && (
            <p
              className="mt-4 rounded-xl px-4 py-6 text-center text-sm"
              style={{ color: "var(--text-mute)", border: "0.5px dashed var(--hairline)" }}
            >
              Nenhum vencimento neste filtro.
            </p>
          )}

          {contagens.d30 > 0 && (
            <div
              className="mt-4 flex items-start gap-2 rounded-md px-3 py-2 text-xs"
              style={{
                background: "rgba(232,138,152,0.10)",
                border: "0.5px solid rgba(232,138,152,0.3)",
                color: "var(--coral-deep)",
              }}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{contagens.d30}</strong> instrumento(s) vencendo em até 30 dias —
                inicie as tratativas de renovação ou aditivo agora.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
