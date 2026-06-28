import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { InstrumentoContratual } from "@/generated/prisma/client";
import { labelCurtoInstrumento, labelInstrumento } from "@/lib/instrumentoLabel";

export type EmpenhoAgenda = {
  id: string;
  numero: string;
  objeto: string;
  orgaoNome: string;
  status: string;
  instrumento: InstrumentoContratual;
  limite: Date;
  janelaInicio: Date;
  janelaFim: Date;
  horaInicio: string | null;
  horaFim: string | null;
};

// Calendario mensal em grid 7 colunas x N linhas (5-6 semanas), eventos
// como barras continuas atravessando dias (estilo Google Calendar). Igor
// 26/06: substitui visao semanal antiga e replica evento multi-dia em
// TODOS os dias do intervalo.
//
// Navegacao por mes via search param ?mesAgenda=YYYY-MM no /dashboard.
//
// Algoritmo de "trilhas" (rows verticais dentro de cada semana): pra
// cada semana, sorteia eventos por data de inicio e atribui a primeira
// trilha livre. Garante barras nao sobrepostas.

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const COR_POR_STATUS: Record<string, { bg: string; border: string; text: string }> = {
  EMPENHADO:       { bg: "rgba(212,175,55,0.85)",  border: "rgba(168,137,71,1)",  text: "#FFFFFF" },
  PEDIDO_RECEBIDO: { bg: "rgba(14,165,233,0.85)",  border: "rgba(2,132,199,1)",   text: "#FFFFFF" },
  EM_TRANSITO:     { bg: "rgba(139,92,246,0.85)",  border: "rgba(109,40,217,1)",  text: "#FFFFFF" },
  ENTREGUE:        { bg: "rgba(63,168,95,0.85)",   border: "rgba(47,143,76,1)",   text: "#FFFFFF" },
  NF_EMITIDA:      { bg: "rgba(251,113,133,0.85)", border: "rgba(225,29,72,1)",   text: "#FFFFFF" },
  NF_ENCAMINHADA:  { bg: "rgba(244,114,182,0.85)", border: "rgba(219,39,119,1)",  text: "#FFFFFF" },
  PAGO:            { bg: "rgba(63,168,95,0.85)",   border: "rgba(47,143,76,1)",   text: "#FFFFFF" },
};

function zerarHora(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

// segunda da semana que contem `d` (semana inicia na seg, termina dom)
function inicioDaSemana(d: Date): Date {
  const c = zerarHora(d);
  const diaSemana = (c.getDay() + 6) % 7; // 0=seg, 6=dom
  c.setDate(c.getDate() - diaSemana);
  return c;
}

function diffDias(a: Date, b: Date): number {
  return Math.round((zerarHora(a).getTime() - zerarHora(b).getTime()) / 86400000);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatMesAgenda(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function AgendaMes({
  entregas,
  mesReferencia,
  hoje,
}: {
  entregas: EmpenhoAgenda[];
  mesReferencia: Date; // primeiro dia do mes visualizado, hora 00:00
  hoje: Date;
}) {
  const hojeNorm = zerarHora(hoje);
  const primeiroDoMes = zerarHora(new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1));
  const proximoMes = new Date(primeiroDoMes.getFullYear(), primeiroDoMes.getMonth() + 1, 1);

  // Grid arranca na seg da semana do dia 1 e cobre semanas inteiras ate
  // engolir todos os dias do mes. Sempre 6 linhas pra evitar pulo de altura.
  const inicioGrid = inicioDaSemana(primeiroDoMes);
  const TOTAL_SEMANAS = 6;
  const semanas: Date[] = [];
  for (let i = 0; i < TOTAL_SEMANAS; i++) {
    semanas.push(new Date(inicioGrid.getTime() + i * 7 * 86400000));
  }

  const mesAnt = new Date(primeiroDoMes.getFullYear(), primeiroDoMes.getMonth() - 1, 1);
  const mesProx = new Date(primeiroDoMes.getFullYear(), primeiroDoMes.getMonth() + 1, 1);

  return (
    <section
      className="glass overflow-hidden rounded-[20px] px-5 py-5"
      style={{ border: "0.5px solid var(--hairline)" }}
    >
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3
            className="text-[12px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--primary-deep)" }}
          >
            Agenda · {NOMES_MES[primeiroDoMes.getMonth()]} {primeiroDoMes.getFullYear()}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-soft)" }}>
            {entregas.length} execução(ões) com janela neste mês
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/dashboard?mesAgenda=${formatMesAgenda(mesAnt)}#agenda`}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/70"
            style={{ border: "0.5px solid var(--hairline)", color: "var(--text)" }}
            aria-label={`${NOMES_MES[mesAnt.getMonth()]} ${mesAnt.getFullYear()}`}
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href="/dashboard#agenda"
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase transition hover:bg-white/70"
            style={{ border: "0.5px solid var(--hairline)", color: "var(--text)", letterSpacing: "0.08em" }}
          >
            Hoje
          </Link>
          <Link
            href={`/dashboard?mesAgenda=${formatMesAgenda(mesProx)}#agenda`}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/70"
            style={{ border: "0.5px solid var(--hairline)", color: "var(--text)" }}
            aria-label={`${NOMES_MES[mesProx.getMonth()]} ${mesProx.getFullYear()}`}
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </header>

      <div id="agenda" className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {DIAS_SEMANA.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center text-[10px] font-bold uppercase"
            style={{
              letterSpacing: "0.12em",
              color: "var(--text-mute)",
              borderBottom: "0.5px solid var(--hairline)",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 flex flex-col gap-1">
        {semanas.map((iniSemana, idxSemana) => (
          <SemanaRow
            key={idxSemana}
            inicioSemana={iniSemana}
            mesReferencia={primeiroDoMes}
            proximoMes={proximoMes}
            entregas={entregas}
            hojeNorm={hojeNorm}
          />
        ))}
      </div>

      {entregas.length === 0 && (
        <div
          className="mt-3 rounded-xl px-6 py-4 text-center"
          style={{ border: "0.5px dashed var(--hairline)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-soft)" }}>
            Nenhuma execução com janela em {NOMES_MES[primeiroDoMes.getMonth()]}.
          </p>
        </div>
      )}
    </section>
  );
}

// === Renderiza uma linha (semana) com fundo dos 7 dias + camada de barras absolutas ===

function SemanaRow({
  inicioSemana,
  mesReferencia,
  proximoMes,
  entregas,
  hojeNorm,
}: {
  inicioSemana: Date;
  mesReferencia: Date;
  proximoMes: Date;
  entregas: EmpenhoAgenda[];
  hojeNorm: Date;
}) {
  const fimSemana = new Date(inicioSemana.getTime() + 7 * 86400000);

  // Eventos cuja janela intersecta esta semana
  const eventosNaSemana = entregas.filter(
    (e) => e.janelaInicio < fimSemana && e.janelaFim >= inicioSemana,
  );

  // Atribuicao de trilhas: pra cada evento, encontra primeira trilha livre.
  // Trilha = linha vertical dentro da semana. Greedy por inicio.
  type EventoComLayout = EmpenhoAgenda & {
    colInicio: number; // 0..6
    colFim: number;    // 0..6 (inclusivo)
    trilha: number;
  };
  const ordenados = [...eventosNaSemana].sort(
    (a, b) => a.janelaInicio.getTime() - b.janelaInicio.getTime(),
  );
  const trilhas: Array<EventoComLayout[]> = [];
  const layouts: EventoComLayout[] = [];
  for (const e of ordenados) {
    const colIni = Math.max(0, diffDias(e.janelaInicio, inicioSemana));
    const colFim = Math.min(6, diffDias(e.janelaFim, inicioSemana));
    if (colIni > 6 || colFim < 0) continue;
    let trilhaIdx = trilhas.findIndex(
      (t) => t.length === 0 || t[t.length - 1].colFim < colIni,
    );
    if (trilhaIdx === -1) {
      trilhaIdx = trilhas.length;
      trilhas.push([]);
    }
    const layout: EventoComLayout = { ...e, colInicio: colIni, colFim, trilha: trilhaIdx };
    trilhas[trilhaIdx].push(layout);
    layouts.push(layout);
  }

  const ALTURA_BARRA = 22; // px
  const GAP_BARRA = 3; // px
  const HEADER_DIA = 22; // px reservado pro numero do dia
  const PAD_BOTTOM = 6;
  const numTrilhas = Math.max(trilhas.length, 1);
  const alturaMinima = HEADER_DIA + numTrilhas * (ALTURA_BARRA + GAP_BARRA) + PAD_BOTTOM;

  return (
    <div className="relative" style={{ minHeight: `${alturaMinima}px` }}>
      {/* Fundo dos 7 dias */}
      <div className="grid h-full gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {Array.from({ length: 7 }).map((_, i) => {
          const dia = new Date(inicioSemana.getTime() + i * 86400000);
          const ehHoje = dia.getTime() === hojeNorm.getTime();
          const foraDoMes = dia < mesReferencia || dia >= proximoMes;
          return (
            <div
              key={i}
              className="rounded-lg"
              style={{
                background: ehHoje
                  ? "rgba(212,175,55,0.14)"
                  : foraDoMes
                    ? "rgba(15,14,12,0.015)"
                    : "rgba(15,14,12,0.03)",
                border: ehHoje
                  ? "0.5px solid rgba(168,137,71,0.5)"
                  : "0.5px solid var(--hairline)",
                minHeight: `${alturaMinima}px`,
              }}
            >
              <div className="flex items-center justify-between px-2 pt-1.5">
                <span
                  className="text-[11px] font-bold"
                  style={{
                    color: ehHoje
                      ? "var(--primary-deep)"
                      : foraDoMes
                        ? "var(--text-mute)"
                        : "var(--text)",
                  }}
                >
                  {dia.getDate()}
                </span>
                {ehHoje && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold"
                    style={{
                      background: "var(--primary-deep)",
                      color: "white",
                      letterSpacing: "0.06em",
                    }}
                  >
                    HOJE
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Camada de barras absolutas. Cada barra ocupa colInicio..colFim
          em uma trilha. Posicionada por % de largura. */}
      <div className="pointer-events-none absolute inset-0">
        {layouts.map((ev) => {
          const colSpan = ev.colFim - ev.colInicio + 1;
          const leftPct = (ev.colInicio / 7) * 100;
          const widthPct = (colSpan / 7) * 100;
          const topPx = HEADER_DIA + ev.trilha * (ALTURA_BARRA + GAP_BARRA);
          const atrasado = ev.limite < hojeNorm;
          const cor = COR_POR_STATUS[ev.status] ?? COR_POR_STATUS.EMPENHADO;
          const corBg = atrasado ? "rgba(225,29,72,0.9)" : cor.bg;
          const corBorder = atrasado ? "rgba(190,18,60,1)" : cor.border;
          // Mostra hora SO no card do dia de inicio (evita poluir nos dias do meio)
          const ehDiaInicio = diffDias(ev.janelaInicio, inicioSemana) === ev.colInicio;
          const rotuloHora = ehDiaInicio && ev.horaInicio ? `${ev.horaInicio}${ev.horaFim ? `–${ev.horaFim}` : ""}` : null;
          return (
            <div
              key={`${ev.id}-${ev.trilha}-${ev.colInicio}`}
              className="pointer-events-auto absolute"
              style={{
                left: `calc(${leftPct}% + 4px)`,
                width: `calc(${widthPct}% - 8px)`,
                top: `${topPx}px`,
                height: `${ALTURA_BARRA}px`,
              }}
            >
              <Link
                href={`/execucao/${ev.id}`}
                className="flex h-full items-center gap-1.5 overflow-hidden rounded-md px-2 text-[10px] font-bold hover:opacity-90"
                style={{
                  background: corBg,
                  border: `0.5px solid ${corBorder}`,
                  color: cor.text,
                  letterSpacing: "0.02em",
                }}
                title={`${labelInstrumento(ev.instrumento)} ${ev.numero} · ${ev.orgaoNome} · ${ev.objeto}${ev.horaInicio ? ` · ${ev.horaInicio}${ev.horaFim ? `–${ev.horaFim}` : ""}` : ""}`}
              >
                {rotuloHora && (
                  <span
                    className="shrink-0 rounded px-1 py-0.5 text-[9px]"
                    style={{ background: "rgba(255,255,255,0.25)" }}
                  >
                    {rotuloHora}
                  </span>
                )}
                <span className="truncate">
                  {labelCurtoInstrumento(ev.instrumento)} {ev.numero} · {ev.orgaoNome}
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Parseador do search param ?mesAgenda=YYYY-MM. Retorna primeiro dia
// do mes (hora 00:00). Default: mes corrente. Defensivo a valores
// invalidos (cai pro mes atual).
export function parseMesAgenda(raw: string | undefined): Date {
  const hoje = new Date();
  if (!raw) return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ano = Number(m[1]);
  const mes = Number(m[2]) - 1;
  if (isNaN(ano) || isNaN(mes) || mes < 0 || mes > 11) {
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }
  return new Date(ano, mes, 1);
}
