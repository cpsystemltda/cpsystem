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
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  // Gradient da cor base (lavender translúcido) até o dourado da marca — paleta Liquid Glass
  const colorScale = useMemo(
    () => scaleSequential<string>(interpolateRgb("#5A4F6E", "#E8C875")).domain([0, maxEmpresas]),
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
          background: "rgba(255,255,255,0.04)",
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
          const valor = dado?.empresas ?? 0;
          const fill = valor > 0 ? colorScale(valor) : "rgba(255, 255, 255, 0.06)";
          const isHover = hover?.uf === uf;
          const d = pathFn(feature as unknown as GeoJSON.Feature) || "";
          const centroid = pathFn.centroid(feature as unknown as GeoJSON.Feature);
          // UFs com mais valor recebem glow (drop-shadow) com a cor da marca
          const isTop = valor >= maxEmpresas * 0.6;
          return (
            <g key={`${uf}-${i}`}>
              <path
                d={d}
                fill={fill}
                stroke={isHover ? "#FFFFFF" : "rgba(255,255,255,0.18)"}
                strokeWidth={isHover ? 1.4 : 0.6}
                className="transition-all duration-150 cursor-pointer"
                style={isTop ? { filter: "drop-shadow(0 0 12px rgba(212, 175, 55, 0.45))" } : undefined}
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
              {valor > 0 && (
                <text
                  x={centroid[0]}
                  y={centroid[1]}
                  textAnchor="middle"
                  fontSize={valor > maxEmpresas * 0.4 ? 14 : 11}
                  fontWeight={800}
                  fill={valor > maxEmpresas * 0.5 ? "#0A0A0A" : "#FFFFFF"}
                  pointerEvents="none"
                  fontFamily="Inter, sans-serif"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {uf}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip — glass dark */}
      {hover && (
        <div
          className="glass-tile pointer-events-none absolute z-20 min-w-[220px] rounded-xl p-3.5 text-xs"
          style={{
            left: Math.min(hover.x + 16, (wrapperRef.current?.clientWidth ?? WIDTH) - 240),
            top: Math.max(hover.y - 60, 8),
            background: "rgba(20, 20, 28, 0.92)",
          }}
        >
          <p className="font-bold" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
            {ESTADOS_NOMES[hover.uf] ?? hover.uf}
          </p>
          {dadoHover ? (
            <div className="mt-2 space-y-1">
              <Linha label="Empresas atendidas" valor={dadoHover.empresas.toString()} />
              <Linha label="Contratos" valor={dadoHover.contratos.toString()} />
              <Linha label="Empenhos" valor={dadoHover.empenhos.toString()} />
              <Linha label="Valor em carteira" valor={brl(dadoHover.valor)} cor="var(--mint)" />
            </div>
          ) : (
            <p className="mt-1" style={{ color: "var(--text-mute)" }}>Sem operações neste estado.</p>
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
      <span style={{ color: "var(--text-mute)" }}>{label}</span>
      <span className="font-semibold" style={{ color: cor ?? "var(--text)" }}>{valor}</span>
    </div>
  );
}
