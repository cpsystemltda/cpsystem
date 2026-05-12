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

type Filtro = "TODOS" | "ATA" | "CONTRATO" | "30" | "60" | "90" | "120";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "ATA", label: "Atas" },
  { value: "CONTRATO", label: "Contratos" },
  { value: "30", label: "≤ 30 dias" },
  { value: "60", label: "≤ 60 dias" },
  { value: "90", label: "≤ 90 dias" },
  { value: "120", label: "≤ 120 dias" },
];

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
 * Timeline horizontal unificada de vencimentos de Atas e Contratos.
 * Inspiração: dashboard CBMDF – SICON. Marcadores em 30/60/90/120 dias;
 * cada Ata/Contrato é plotado proporcionalmente entre hoje (esquerda) e
 * 120 dias (direita). Cores indicam proximidade.
 */
export function TimelineVencimentos({ itens }: { itens: Item[] }) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  // hoje virgem (sem horas) — evita off-by-one quando vigência cai em dia atual
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Dias restantes (≥ 0 entre hoje e 120 dias). Vencidos não entram.
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
      if (filtro === "ATA") return i.tipo === "ata";
      if (filtro === "CONTRATO") return i.tipo === "contrato";
      if (filtro === "30") return i.dias <= 30;
      if (filtro === "60") return i.dias <= 60;
      if (filtro === "90") return i.dias <= 90;
      if (filtro === "120") return i.dias <= 120;
      return true;
    });
  }, [itensComDias, filtro]);

  // Contagens por faixa (mostradas em chips de filtro)
  const contagens = useMemo(() => {
    return {
      todos: itensComDias.length,
      ata: itensComDias.filter((i) => i.tipo === "ata").length,
      contrato: itensComDias.filter((i) => i.tipo === "contrato").length,
      d30: itensComDias.filter((i) => i.dias <= 30).length,
      d60: itensComDias.filter((i) => i.dias <= 60).length,
      d90: itensComDias.filter((i) => i.dias <= 90).length,
      d120: itensComDias.length, // mesmo que todos por definição da janela
    };
  }, [itensComDias]);

  function contagemDoFiltro(f: Filtro): number {
    if (f === "TODOS") return contagens.todos;
    if (f === "ATA") return contagens.ata;
    if (f === "CONTRATO") return contagens.contrato;
    if (f === "30") return contagens.d30;
    if (f === "60") return contagens.d60;
    if (f === "90") return contagens.d90;
    return contagens.d120;
  }

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
            Atas e Contratos em janela de 120 dias. Clique em um marcador para abrir o detalhe.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const ativo = filtro === f.value;
            const contagem = contagemDoFiltro(f.value);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition"
                style={{
                  background: ativo ? "var(--primary-deep)" : "rgba(15,14,12,0.04)",
                  color: ativo ? "white" : "var(--text-soft)",
                  border: ativo ? "none" : "0.5px solid var(--hairline)",
                }}
              >
                {f.label}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: ativo ? "rgba(255,255,255,0.25)" : "rgba(15,14,12,0.06)",
                  }}
                >
                  {contagem}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {itensComDias.length === 0 ? (
        <div
          className="rounded-xl px-6 py-12 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <CalendarClock
            className="mx-auto h-8 w-8"
            style={{ color: "var(--text-mute)" }}
          />
          <p
            className="mt-3 text-sm font-extrabold"
            style={{ color: "var(--text)" }}
          >
            Nenhum vencimento nos próximos 120 dias.
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>
            Você está com a carteira folgada. Volte aqui em algumas semanas.
          </p>
        </div>
      ) : (
        <>
          {/* Eixo horizontal com marcas em 30/60/90/120 */}
          <div className="relative mb-6 h-6 w-full">
            <div
              className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
              style={{ background: "var(--hairline)" }}
            />
            {[0, 30, 60, 90, 120].map((d) => {
              const pct = (d / 120) * 100;
              return (
                <div
                  key={d}
                  className="absolute top-0 flex h-full flex-col items-center"
                  style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                >
                  <div
                    className="h-2 w-px"
                    style={{ background: "var(--text-mute)" }}
                  />
                  <span
                    className="mt-0.5 text-[10px] tabular"
                    style={{ color: "var(--text-mute)" }}
                  >
                    {d === 0 ? "hoje" : `${d}d`}
                  </span>
                </div>
              );
            })}
          </div>

          {filtrados.length === 0 ? (
            <p
              className="rounded-xl px-4 py-6 text-center text-sm"
              style={{
                color: "var(--text-mute)",
                border: "0.5px dashed var(--hairline)",
              }}
            >
              Nenhum vencimento neste filtro.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtrados.map((i) => {
                const cor = corDeDias(i.dias);
                const pct = Math.min(100, Math.max(0, (i.dias / 120) * 100));
                const href = i.tipo === "ata" ? `/atas/${i.id}` : `/contratos/${i.id}`;
                return (
                  <li key={`${i.tipo}-${i.id}`}>
                    <Link
                      href={href}
                      className="group relative block rounded-lg px-3 py-2 transition hover:-translate-y-px"
                      style={{
                        background: cor.bg,
                        border: `0.5px solid ${cor.fg}55`,
                      }}
                      title={`${i.tipo === "ata" ? "Ata" : "Contrato"} ${i.numero} · ${i.orgaoNome}`}
                    >
                      <div className="flex items-center gap-3 text-xs">
                        {i.tipo === "ata" ? (
                          <FileText
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: cor.fg }}
                          />
                        ) : (
                          <ClipboardList
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: cor.fg }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate font-bold"
                            style={{ color: cor.fg }}
                          >
                            {i.tipo === "ata" ? "Ata" : "Contrato"} {i.numero}
                            <span
                              className="ml-1 font-normal"
                              style={{ opacity: 0.75 }}
                            >
                              · {i.orgaoNome}
                            </span>
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase"
                          style={{
                            background: cor.fg,
                            color: "white",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {i.dias === 0
                            ? "vence hoje"
                            : i.dias === 1
                              ? "1 dia"
                              : `${i.dias} dias`}
                        </span>
                        <span
                          className="shrink-0 text-[10px] tabular"
                          style={{ color: cor.fg, opacity: 0.7 }}
                        >
                          {i.vigenciaFim.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {/* mini-barra mostrando posição na timeline */}
                      <div
                        className="mt-1.5 h-1 w-full rounded-full"
                        style={{ background: "rgba(255,255,255,0.4)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${100 - pct}%`,
                            background: cor.fg,
                          }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {contagens.d30 > 0 && (
            <div
              className="mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs"
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
