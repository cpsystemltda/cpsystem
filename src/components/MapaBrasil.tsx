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

export function MapaBrasil({
  dados,
  ufDestaque,
}: {
  dados: DadosUf[];
  // UF a destacar (vinda da lista de clientes — sync lista↔mapa).
  // Quando presente, o estado correspondente recebe stroke mais grosso.
  ufDestaque?: string | null;
}) {
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

  // UFs com operação (qualquer dimensão > 0). Usado pro zoom inteligente
  // e pro destaque visual.
  const ufsComOperacao = useMemo(() => {
    const set = new Set<string>();
    for (const d of dados) {
      if (d.empresas > 0 || d.contratos > 0 || d.empenhos > 0 || d.orgaos > 0) {
        set.add(d.uf);
      }
    }
    return set;
  }, [dados]);

  const projection = useMemo(() => {
    if (!geo) return null;
    // Vizinhos próximos por região — quando a empresa atua em uma UF do
    // centro-oeste, incluímos as do entorno (incluindo DF) pra o mapa
    // mostrar contexto regional ao invés de só o estado em foco. Resolve o
    // caso "GO sozinho ocupa a tela, DF some dentro dele".
    const VIZINHOS: Record<string, string[]> = {
      GO: ["DF", "MT", "MS", "MG", "BA", "TO"],
      DF: ["GO"],
      MG: ["SP", "RJ", "ES", "BA", "GO", "MS"],
      SP: ["MG", "RJ", "PR", "MS"],
      RJ: ["MG", "SP", "ES"],
      ES: ["RJ", "MG", "BA"],
      // demais regiões usam só o que a empresa tem — fitExtent já é
      // adequado quando há vários estados na lista.
    };
    let ufsParaFit = new Set(ufsComOperacao);
    if (ufsComOperacao.size === 1) {
      const unica = Array.from(ufsComOperacao)[0];
      const viz = VIZINHOS[unica];
      if (viz) for (const v of viz) ufsParaFit.add(v);
    }
    if (ufsParaFit.size === 0) ufsParaFit = new Set();
    const featuresParaFit =
      ufsParaFit.size > 0
        ? geo.features.filter(
            (f) => f.properties.UF && ufsParaFit.has(f.properties.UF),
          )
        : geo.features;
    const collection = { type: "FeatureCollection", features: featuresParaFit };
    const margem = ufsParaFit.size > 0 ? 0.08 : 0.05;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return geoMercator().fitExtent(
      [
        [WIDTH * margem, HEIGHT * margem],
        [WIDTH * (1 - margem), HEIGHT * (1 - margem)],
      ],
      collection as any,
    );
  }, [geo, ufsComOperacao]);

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
          const isDestaque = ufDestaque === uf;
          const d = pathFn(feature as unknown as GeoJSON.Feature) || "";
          const centroid = pathFn.centroid(feature as unknown as GeoJSON.Feature);
          const isTop = temOperacao;
          return (
            <g key={`${uf}-${i}`}>
              <path
                d={d}
                fill={fill}
                stroke={isHover || isDestaque ? "var(--primary-deep)" : "rgba(15,14,12,0.16)"}
                strokeWidth={isHover || isDestaque ? 2 : 0.6}
                className="transition-all duration-150 cursor-pointer"
                style={
                  isDestaque
                    ? { filter: "drop-shadow(0 0 14px rgba(168,137,71,0.55))" }
                    : isTop
                      ? { filter: "drop-shadow(0 0 12px rgba(212, 175, 55, 0.30))" }
                      : undefined
                }
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
              {/* Esconde a sigla na camada base quando o estado é pequeno
                 E tem operação — nesse caso a sigla aparece dentro do pin
                 dourado renderizado na camada superior. Estados grandes
                 (mesmo com operação) e sem operação seguem mostrando aqui. */}
              {(() => {
                const pequenoComOperacao =
                  temOperacao &&
                  ["DF", "AL", "SE", "RJ", "ES", "PB", "RN"].includes(uf);
                if (pequenoComOperacao) return null;
                return (
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
                );
              })()}
            </g>
          );
        })}

        {/* Camada superior: markers visuais + hit areas. Renderizada DEPOIS
           de todos os paths pra garantir:
           (a) Estados pequenos (DF, AL, SE, RJ, ES, PB, RN) ganham pin
               visível sempre — mesmo sem operação, pra não sumirem dentro
               do estado-pai (caso clássico: DF embutido no GO).
           (b) Hit area no topo não é coberta pelo path do estado vizinho. */}
        {geo.features.map((feature, i) => {
          const uf = feature.properties.UF;
          if (!uf || !pathFn) return null;
          const dado = dadosMap.get(uf);
          const temOperacao = !!dado && (
            dado.empresas > 0 || dado.contratos > 0 || dado.empenhos > 0 || dado.orgaos > 0
          );
          const pequeno = ["DF", "AL", "SE", "RJ", "ES", "PB", "RN"].includes(uf);
          // Pequeno sempre ganha marker (operação ou não). Estado grande sem
          // operação não recebe pin — fica só com seu path normal.
          if (!temOperacao && !pequeno) return null;
          const centroid = pathFn.centroid(feature as unknown as GeoJSON.Feature);
          const isHover = hover?.uf === uf;
          const isDestaqueRow = ufDestaque === uf;
          // Visual diferenciado por estado:
          //  - com operação: dourado vibrante
          //  - sem operação (estado pequeno): cinza médio com borda branca,
          //    serve só como "âncora visual" pra que o estado não desapareça
          //    embutido em outro maior.
          const corFundo = temOperacao
            ? "var(--primary-deep)"
            : "rgba(140,130,110,0.85)";
          const corTexto = "white";
          return (
            <g key={`pin-${uf}-${i}`} style={{ pointerEvents: "auto" }}>
              {pequeno && (() => {
                // Pin quadrado para estados pequenos. DF é o caso crítico
                // — embutido em GO, precisa de tamanho generoso pra leitura
                // e hover. Demais (AL, SE, RJ, ES, PB, RN) ficam um pouco
                // menores porque têm costa visível ao redor.
                const isDF = uf === "DF";
                const lado = isDF
                  ? (isHover || isDestaqueRow ? 44 : 38)
                  : (isHover || isDestaqueRow ? 32 : 26);
                const fontSize = isDF
                  ? (isHover || isDestaqueRow ? 16 : 14)
                  : (isHover || isDestaqueRow ? 13 : 11);
                return (
                  <>
                    <rect
                      x={centroid[0] - lado / 2}
                      y={centroid[1] - lado / 2}
                      width={lado}
                      height={lado}
                      rx={5}
                      ry={5}
                      fill={corFundo}
                      stroke="white"
                      strokeWidth={3}
                      className="transition-all duration-150"
                      style={{
                        filter: temOperacao
                          ? "drop-shadow(0 0 6px rgba(168,137,71,0.7)) drop-shadow(0 2px 4px rgba(0,0,0,0.35))"
                          : "drop-shadow(0 1px 3px rgba(0,0,0,0.25))",
                      }}
                    />
                    <text
                      x={centroid[0]}
                      y={centroid[1] + 1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight={900}
                      fill={corTexto}
                      pointerEvents="none"
                      fontFamily="Inter, sans-serif"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {uf}
                    </text>
                  </>
                );
              })()}
              {/* Hit area apenas para estados COM operação (clique tem
                 sentido só nesses). Pequenos sem operação ganham só o pin
                 visual de orientação, sem ser clicáveis. */}
              {temOperacao && (
                <rect
                  x={centroid[0] - (pequeno ? (uf === "DF" ? 26 : 20) : 16)}
                  y={centroid[1] - (pequeno ? (uf === "DF" ? 26 : 20) : 16)}
                  width={pequeno ? (uf === "DF" ? 52 : 40) : 32}
                  height={pequeno ? (uf === "DF" ? 52 : 40) : 32}
                  fill="transparent"
                  pointerEvents="all"
                  className="cursor-pointer"
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
              )}
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
