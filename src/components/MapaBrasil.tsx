"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { scaleSequential } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";

const ESTADOS_NOMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

export type DadosUf = {
  uf: string;
  empresas: number;
  contratos: number;
  empenhos: number;
  // Órgãos públicos distintos atendidos no estado (gerenciador + participantes
  // de Atas, contratantes diretos de Contratos, contratantes de Empenhos).
  orgaos: number;
  valor: number;
};

type GeoFeature = {
  type: string;
  properties: { UF?: string; ESTADO?: string };
  geometry: GeoJSON.Geometry;
};
type GeoCollection = { type: string; features: GeoFeature[] };

const WIDTH = 600;
const HEIGHT = 480;

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function MapaBrasil({ dados }: { dados: DadosUf[] }) {
  const [geo, setGeo] = useState<GeoCollection | null>(null);
  const [hover, setHover] = useState<{ uf: string; x: number; y: number } | null>(null);
  const [wrapperWidth, setWrapperWidth] = useState<number>(WIDTH);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    setWrapperWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWrapperWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fetch("/brasil-uf.geojson")
      .then((r) => r.json())
      .then((g: GeoCollection) => setGeo(g))
      .catch(() => setGeo(null));
  }, []);

  const dadosMap = useMemo(() => {
    const m = new Map<string, DadosUf>();
    for (const d of dados) m.set(d.uf, d);
    return m;
  }, [dados]);

  const maxEmpresas = useMemo(() => Math.max(1, ...dados.map((d) => d.empresas)), [dados]);
  // Gradient choropleth: do creme suave até o dourado deep — paleta Liquid Glass clean
  const colorScale = useMemo(
    () => scaleSequential<string>(interpolateRgb("#EDE5D0", "#A88947")).domain([0, maxEmpresas]),
    [maxEmpresas],
  );

  const projection = useMemo(() => {
    if (!geo) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return geoMercator().fitSize([WIDTH, HEIGHT], geo as any);
  }, [geo]);

  const pathFn = useMemo(() => (projection ? geoPath(projection) : null), [projection]);

  if (!geo || !pathFn) {
    return (
      <div
        className="grid h-[360px] place-items-center rounded-2xl text-sm"
        style={{
          color: "var(--text-mute)",
          background: "rgba(15,14,12,0.03)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        Carregando mapa do Brasil…
      </div>
    );
  }

  const dadoHover = hover ? dadosMap.get(hover.uf) : null;
  const total = dados.reduce(
    (acc, d) => ({
      empresas: acc.empresas + d.empresas,
      contratos: acc.contratos + d.contratos,
      empenhos: acc.empenhos + d.empenhos,
      valor: acc.valor + d.valor,
    }),
    { empresas: 0, contratos: 0, empenhos: 0, valor: 0 },
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mx-auto block w-full"
        style={{ maxHeight: "320px" }}
        preserveAspectRatio="xMidYMid meet"
      >
        {geo.features.map((feature, i) => {
          const uf = feature.properties.UF;
          if (!uf) return null;
          const dado = dadosMap.get(uf);
          // Estado tem operação se aparece em qualquer dimensão (empresas,
          // contratos, empenhos OU órgãos atendidos). Antes só considerava
          // empresas — DF com órgãos mas sem filial ficava cinza.
          const temOperacao = !!dado && (
            dado.empresas > 0 || dado.contratos > 0 || dado.empenhos > 0 || dado.orgaos > 0
          );
          const valor = dado?.empresas ?? 0;
          // Cor original (sutil, glass-friendly): estados sem operação em
          // cinza translúcido; com operação em dourado via colorScale.
          const fill = temOperacao
            ? colorScale(Math.max(1, valor))
            : "rgba(15, 14, 12, 0.06)";
          const isHover = hover?.uf === uf;
          const d = pathFn(feature as unknown as GeoJSON.Feature) || "";
          const centroid = pathFn.centroid(feature as unknown as GeoJSON.Feature);
          const isTop = temOperacao;
          return (
            <g key={`${uf}-${i}`}>
              <path
                d={d}
                fill={fill}
                stroke={isHover ? "var(--primary-deep)" : "rgba(15,14,12,0.16)"}
                strokeWidth={isHover ? 1.4 : 0.6}
                className="transition-all duration-150 cursor-pointer"
                style={isTop ? { filter: "drop-shadow(0 0 12px rgba(212, 175, 55, 0.30))" } : undefined}
                onMouseEnter={(e) => {
                  const rect = wrapperRef.current?.getBoundingClientRect();
                  setHover({
                    uf,
                    x: e.clientX - (rect?.left ?? 0),
                    y: e.clientY - (rect?.top ?? 0),
                  });
                }}
                onMouseMove={(e) => {
                  const rect = wrapperRef.current?.getBoundingClientRect();
                  setHover({
                    uf,
                    x: e.clientX - (rect?.left ?? 0),
                    y: e.clientY - (rect?.top ?? 0),
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
              {/* Sigla aparece em TODOS os 27 estados — fundo cinza-creme
                  pros sem operação (legibilidade clara), preto bold pros
                  com operação. Mapa sempre conta a história "Brasil inteiro
                  + onde estamos atuando" sem omitir estados. */}
              <text
                x={centroid[0]}
                y={centroid[1]}
                textAnchor="middle"
                fontSize={temOperacao ? (valor > maxEmpresas * 0.4 ? 14 : 12) : 9}
                fontWeight={temOperacao ? 800 : 600}
                fill={
                  temOperacao
                    ? valor > maxEmpresas * 0.5
                      ? "#0A0A0A"
                      : "#FFFFFF"
                    : "rgba(15,14,12,0.50)"
                }
                pointerEvents="none"
                fontFamily="Inter, sans-serif"
                style={{ letterSpacing: "-0.02em" }}
              >
                {uf}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip — glass clean */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 min-w-[230px] rounded-[14px] px-4 py-3 text-xs"
          style={{
            left: Math.min(hover.x + 16, wrapperWidth - 250),
            top: Math.max(hover.y - 60, 8),
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "0.5px solid rgba(15,14,12,0.12)",
            boxShadow: "0 12px 32px -8px rgba(20,16,8,0.18), 0 2px 8px rgba(20,16,8,0.06)",
            color: "var(--text)",
          }}
        >
          <p
            className="text-[13px] font-extrabold"
            style={{ color: "var(--text)", letterSpacing: "-0.015em" }}
          >
            {ESTADOS_NOMES[hover.uf] ?? hover.uf}
          </p>
          {dadoHover ? (
            <div className="mt-2 space-y-1">
              <Linha label="Órgãos atendidos" valor={dadoHover.orgaos.toString()} />
              <Linha label="Empresas (filiais)" valor={dadoHover.empresas.toString()} />
              <Linha label="Contratos / Atas" valor={dadoHover.contratos.toString()} />
              <Linha label="Empenhos" valor={dadoHover.empenhos.toString()} />
              <Linha
                label="Valor em carteira"
                valor={brl(dadoHover.valor)}
                cor="var(--mint-deep)"
              />
            </div>
          ) : (
            <p className="mt-1" style={{ color: "var(--text-mute)" }}>
              Sem operações neste estado.
            </p>
          )}
        </div>
      )}

      {/* Legenda */}
      <div
        className="mt-3 flex items-center justify-between gap-4 text-xs"
        style={{ color: "var(--text-mute)" }}
      >
        <div className="flex items-center gap-2">
          <span>0</span>
          <span
            className="h-2 w-32 rounded-full"
            style={{
              background: `linear-gradient(to right, ${colorScale(0)}, ${colorScale(maxEmpresas)})`,
            }}
          />
          <span>{maxEmpresas} empresas</span>
        </div>
        <div className="flex gap-4">
          <span>
            <strong style={{ color: "var(--text)" }}>{total.empresas}</strong> empresas
          </span>
          <span>
            <strong style={{ color: "var(--text)" }}>{total.contratos}</strong> contratos
          </span>
          <span>
            <strong style={{ color: "var(--text)" }}>{brl(total.valor)}</strong> em carteira
          </span>
        </div>
      </div>
    </div>
  );
}

function Linha({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--text-soft)" }}>{label}</span>
      <span className="font-extrabold tabular" style={{ color: cor ?? "var(--text)" }}>
        {valor}
      </span>
    </div>
  );
}
