"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { brl } from "@/lib/validators";
import "leaflet/dist/leaflet.css";

export type PinMapa = {
  cnpj: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  precisao: string | null;
  atas: number;
  contratos: number;
  empenhos: number;
  valor: number;
};

export type PinEntregaMapa = {
  id: string;
  endereco: string;
  rotulo: string | null;
  latitude: number;
  longitude: number;
  precisao: string | null;
  atas: number;
  contratos: number;
  empenhos: number;
  orgaos: string[];
};

// Sede de uma EMPRESA da fornecedora (CNPJ cadastrado na conta). Usado
// no toggle "Sua empresa" do mapa pra distinguir das sedes dos orgaos
// publicos atendidos (PinMapa) e dos locais de entrega (PinEntregaMapa).
export type PinEmpresaMapa = {
  id: string;
  cnpj: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  precisao: string | null;
};

// Leaflet quebra em SSR (acessa window). Importa só no client.
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), {
  ssr: false,
});

// Cluster — react-leaflet-cluster também precisa ser dinâmico
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-cluster").then((m) => m.default),
  { ssr: false },
);

// Provedores de tile: mapa padrão (OpenStreetMap) e satélite (Esri World
// Imagery, gratuito sem chave). Ambos respeitam ToS de uso não-comercial
// pesado; pra escala maior, considerar Mapbox/Maptiler com chave.
const TILES = {
  mapa: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — World Imagery",
  },
};

/**
 * Mapa real do Brasil com pins por órgão. Substitui o choropleth SVG em
 * dashboards onde temos pelo menos 1 pin geocodificado. Pra contas sem
 * geocode (ou enquanto Nominatim ainda não respondeu), fallback fora deste
 * componente mostra o choropleth antigo.
 *
 * Features:
 *   - Marker cluster automático (caso clássico DF — várias secretarias em
 *     poucos km).
 *   - Popup com nome do órgão, contagens e valor.
 *   - Tooltip ao hover para destaque rápido.
 *   - Toggle Mapa / Satélite (Esri).
 *   - Zoom inicial = fitBounds nos pins (centralizar nos meus clientes).
 *   - Sync lista↔mapa via prop `cnpjDestaque` (pin destacado por borda).
 */
export function MapaPinsBrasil({
  pins,
  pinsEntregas,
  pinsEmpresas,
  cnpjDestaque,
}: {
  pins: PinMapa[];
  // Quando fornecido, habilita o toggle Sedes/Entregas no canto do mapa.
  pinsEntregas?: PinEntregaMapa[];
  // Sedes da fornecedora (CNPJs da propria conta). Habilita 3a aba "Sua empresa".
  pinsEmpresas?: PinEmpresaMapa[];
  cnpjDestaque?: string | null;
}) {
  // Default = satélite (decisão Regina). Persiste preferência por usuário
  // pra não regredir a cada navegação. Leitura do localStorage só ocorre
  // no client (depois do mount) pra evitar mismatch de SSR.
  const [tileSet, setTileSet] = useState<"mapa" | "satelite">("satelite");
  const [vista, setVista] = useState<"SEDES" | "ENTREGAS" | "EMPRESAS">("SEDES");
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem("cp_mapa_tile");
      if (salvo === "mapa" || salvo === "satelite") setTileSet(salvo);
    } catch {
      // localStorage indisponível (modo privado, etc.) — usa o default.
    }
  }, []);
  function trocarTile(novo: "mapa" | "satelite") {
    setTileSet(novo);
    try {
      window.localStorage.setItem("cp_mapa_tile", novo);
    } catch {
      // ignora — preferência fica só na sessão atual.
    }
  }
  // Factory de icones — em vez de pre-gerar 3-4 icones fixos, agora cada
  // pin recebe um icone com o NUMERO bordado dentro (Regina 01/06: pediu
  // 1,2,3 nos pins pra navegar mais rapido). Mantemos a referencia ao
  // Leaflet global pra criar ícones inline no render dos markers.
  type Factory = (opts: {
    cor: string;
    raio: number;
    numero?: number;
    destaque?: boolean;
  }) => unknown;
  const [iconFactory, setIconFactory] = useState<Factory | null>(null);

  // Ref pra instancia do mapa Leaflet — usada pra flyTo quando o usuario
  // clica num pin na lista (sync lista→mapa pedido pela Regina).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  useEffect(() => {
    if (!cnpjDestaque || !mapRef.current) return;
    const pin = pins.find((p) => p.cnpj === cnpjDestaque);
    if (!pin) return;
    try {
      mapRef.current.flyTo([pin.latitude, pin.longitude], 14, { duration: 0.6 });
    } catch {
      // Mapa ainda nao instanciado/desmontado — ignora.
    }
  }, [cnpjDestaque, pins]);

  useEffect(() => {
    import("leaflet").then((L) => {
      const factory: Factory = ({ cor, raio, numero, destaque }) => {
        const stroke = destaque ? 3 : 2;
        const fontSize = Math.max(11, Math.floor(raio * 0.95));
        const yText = raio + fontSize * 0.36;
        const conteudo =
          numero != null
            ? `<text x="${raio}" y="${yText}" fill="white" font-family="-apple-system,Inter,system-ui,sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle">${numero}</text>`
            : `<circle cx="${raio}" cy="${raio}" r="${raio / 3}" fill="white"/>`;
        const svg = `
          <svg width="${raio * 2}" height="${raio * 2 + 6}" viewBox="0 0 ${raio * 2} ${raio * 2 + 6}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${raio}" cy="${raio}" r="${raio - 1}" fill="${cor}" stroke="white" stroke-width="${stroke}"/>
            ${conteudo}
          </svg>
        `;
        return L.divIcon({
          html: svg,
          className: "",
          iconSize: [raio * 2, raio * 2 + 6],
          iconAnchor: [raio, raio],
          popupAnchor: [0, -raio],
        });
      };
      // Retorna a propria funcao (nao chama) — fica disponivel pro render.
      setIconFactory(() => factory);
    });
  }, []);

  // Bounds iniciais: depende da vista atual. Cada conjunto de pins tem seu
  // próprio enquadramento — útil quando entregas estão em DF e sedes em GO.
  const pinsAtivos =
    vista === "ENTREGAS"
      ? (pinsEntregas ?? [])
      : vista === "EMPRESAS"
        ? (pinsEmpresas ?? [])
        : pins;
  const bounds = useMemo(() => {
    if (pinsAtivos.length === 0) return null;
    let minLat = pinsAtivos[0].latitude;
    let maxLat = pinsAtivos[0].latitude;
    let minLng = pinsAtivos[0].longitude;
    let maxLng = pinsAtivos[0].longitude;
    for (const p of pinsAtivos) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }
    return {
      bounds: [
        [minLat, minLng],
        [maxLat, maxLng],
      ] as [[number, number], [number, number]],
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2] as [number, number],
    };
  }, [pinsAtivos]);

  // Sem pins: ainda mostra o mapa do Brasil em satélite (vazio) — usuário
  // vê o tile real e não cai num fallback feio. Bounds padrão enquadram
  // o país inteiro. Mensagem opcional flutua no topo informando estado.
  const semPinsAtivos = pinsAtivos.length === 0;

  if (!iconFactory) {
    return (
      <div
        className="grid h-[360px] place-items-center rounded-2xl text-sm"
        style={{
          color: "var(--text-mute)",
          background: "rgba(15,14,12,0.03)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        Carregando mapa…
      </div>
    );
  }

  const tile = TILES[tileSet];

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{ border: "0.5px solid var(--hairline)" }}
    >
      {/* Mensagem flutuante quando ainda não há pins (órgãos não
          geocodificados ainda). Mapa abaixo continua interativo. */}
      {semPinsAtivos && (
        <div
          className="absolute bottom-3 left-1/2 z-[500] -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-semibold shadow-md"
          style={{
            background: "rgba(255,255,255,0.95)",
            color: "var(--text)",
            border: "0.5px solid var(--hairline)",
          }}
        >
          Sem pins ainda — geocodificando endereços dos órgãos…
        </div>
      )}
      {/* Controles flutuantes — Órgãos/Entregas/Sua empresa à esquerda,
          Mapa/Satélite à direita. Renomeado/expandido (Regina 31/05) pra
          distinguir os 3 conjuntos de pins (antes 'Sedes' confundia sede
          da fornecedora com sede de orgao publico). */}
      {((pinsEntregas && pinsEntregas.length > 0) || (pinsEmpresas && pinsEmpresas.length > 0)) && (
        <div
          className="absolute left-3 top-3 z-[500] flex rounded-md text-xs font-bold shadow-md"
          style={{ background: "white", border: "0.5px solid var(--hairline)" }}
        >
          <button
            type="button"
            onClick={() => setVista("SEDES")}
            className="px-3 py-1.5 transition"
            style={{
              background: vista === "SEDES" ? "var(--primary-deep)" : "transparent",
              color: vista === "SEDES" ? "white" : "var(--text)",
              borderRadius: "6px 0 0 6px",
            }}
            title="Órgãos públicos atendidos (com endereço geocodificado)"
          >
            Órgãos ({pins.length})
          </button>
          {pinsEntregas && pinsEntregas.length > 0 && (
            <button
              type="button"
              onClick={() => setVista("ENTREGAS")}
              className="px-3 py-1.5 transition"
              style={{
                background: vista === "ENTREGAS" ? "var(--mint-deep)" : "transparent",
                color: vista === "ENTREGAS" ? "white" : "var(--text)",
              }}
              title="Locais de entrega cadastrados"
            >
              Entregas ({pinsEntregas.length})
            </button>
          )}
          {pinsEmpresas && pinsEmpresas.length > 0 && (
            <button
              type="button"
              onClick={() => setVista("EMPRESAS")}
              className="px-3 py-1.5 transition"
              style={{
                background: vista === "EMPRESAS" ? "var(--sky-deep, #3F638F)" : "transparent",
                color: vista === "EMPRESAS" ? "white" : "var(--text)",
                borderRadius: "0 6px 6px 0",
              }}
              title="Sedes das suas empresas (CNPJs cadastrados)"
            >
              Sua empresa ({pinsEmpresas.length})
            </button>
          )}
        </div>
      )}
      <div
        className="absolute right-3 top-3 z-[500] flex rounded-md text-xs font-bold shadow-md"
        style={{ background: "white", border: "0.5px solid var(--hairline)" }}
      >
        <button
          type="button"
          onClick={() => trocarTile("mapa")}
          className="px-3 py-1.5 transition"
          style={{
            background: tileSet === "mapa" ? "var(--primary-deep)" : "transparent",
            color: tileSet === "mapa" ? "white" : "var(--text)",
            borderRadius: "6px 0 0 6px",
          }}
        >
          Mapa
        </button>
        <button
          type="button"
          onClick={() => trocarTile("satelite")}
          className="px-3 py-1.5 transition"
          style={{
            background: tileSet === "satelite" ? "var(--primary-deep)" : "transparent",
            color: tileSet === "satelite" ? "white" : "var(--text)",
            borderRadius: "0 6px 6px 0",
          }}
        >
          Satélite
        </button>
      </div>

      <MapContainer
        key={vista /* força re-fit quando troca de vista */}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={mapRef as any}
        bounds={bounds?.bounds ?? [[-34, -74], [6, -33]]}
        boundsOptions={{ padding: [40, 40], maxZoom: 12 }}
        // Trava a navegação ao retângulo do Brasil — usuário não pode dar
        // zoom out até ver o globo nem arrastar pra África. minZoom=4 mantém
        // o país inteiro como menor enquadramento possível.
        maxBounds={[
          [-34.0, -74.0], // sudoeste (RS / fronteira oeste)
          [ 6.0,  -33.0], // nordeste (Roraima / RN)
        ]}
        maxBoundsViscosity={1.0}
        minZoom={4}
        maxZoom={16}
        scrollWheelZoom
        style={{ height: 420, width: "100%" }}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} noWrap />
        {/* Cluster desligado por padrao: a Regina precisa ver TODOS os
            numeros (1, 2, 3...) dos pins individuais — o cluster
            agrupava os pins proximos num so circulo com a contagem,
            escondendo os numeros individuais. Mantemos o
            MarkerClusterGroup com disableClusteringAtZoom=4 pra que
            mesmo no zoom mais distante ja apareca individual. */}
        <MarkerClusterGroup chunkedLoading disableClusteringAtZoom={4} spiderfyOnMaxZoom={false} showCoverageOnHover={false} maxClusterRadius={0}>
          {vista === "SEDES" && pins.map((p, idx) => {
            const numero = idx + 1;
            const isDestaque = cnpjDestaque === p.cnpj;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const icone = iconFactory({
              cor: isDestaque ? "#A88947" : "#7a5c1a",
              raio: isDestaque ? 15 : 13,
              numero,
              destaque: isDestaque,
            }) as any;
            return (
              <Marker key={p.cnpj} position={[p.latitude, p.longitude]} icon={icone}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div style={{ minWidth: 200 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>
                      <span style={{ display: "inline-block", minWidth: 18, marginRight: 6, padding: "0 6px", background: "#7a5c1a", color: "white", borderRadius: 9, fontSize: 11 }}>{numero}</span>
                      {p.nome}
                    </p>
                    <p style={{ fontSize: 11, color: "#666" }}>
                      {p.atas} ata{p.atas !== 1 ? "s" : ""} ·{" "}
                      {p.contratos} contrato{p.contratos !== 1 ? "s" : ""} ·{" "}
                      {p.empenhos} empenho{p.empenhos !== 1 ? "s" : ""}
                    </p>
                    {p.valor > 0 && (
                      <p style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                        {brl(p.valor)}
                      </p>
                    )}
                    {p.precisao && p.precisao !== "exact" && (
                      <p style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                        Localização aproximada ({p.precisao})
                      </p>
                    )}
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 220 }}>
                    <p style={{ fontWeight: 800, marginBottom: 6 }}>{p.nome}</p>
                    <p style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
                      {p.endereco}
                    </p>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <div>
                        <strong>{p.atas}</strong> ata{p.atas !== 1 ? "s" : ""} vigente
                        {p.atas !== 1 ? "s" : ""}
                      </div>
                      <div>
                        <strong>{p.contratos}</strong> contrato
                        {p.contratos !== 1 ? "s" : ""} vigente
                        {p.contratos !== 1 ? "s" : ""}
                      </div>
                      <div>
                        <strong>{p.empenhos}</strong> empenho{p.empenhos !== 1 ? "s" : ""}
                      </div>
                      {p.valor > 0 && (
                        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800 }}>
                          {brl(p.valor)}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {vista === "ENTREGAS" && pinsEntregas?.map((p, idx) => {
            const numero = idx + 1;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const icone = iconFactory({
              cor: "#1f6f55",
              raio: 13,
              numero,
            }) as any;
            return (
              <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icone}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div style={{ minWidth: 220 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>
                      <span style={{ display: "inline-block", minWidth: 18, marginRight: 6, padding: "0 6px", background: "#1f6f55", color: "white", borderRadius: 9, fontSize: 11 }}>{numero}</span>
                      {p.rotulo || "Local de entrega"}
                    </p>
                    <p style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                      {p.endereco}
                    </p>
                    <p style={{ fontSize: 11, color: "#1f6f55", fontWeight: 700 }}>
                      {p.atas + p.contratos + p.empenhos} entrega
                      {p.atas + p.contratos + p.empenhos !== 1 ? "s" : ""} aqui
                    </p>
                    {p.precisao && p.precisao !== "exact" && (
                      <p style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                        Localização aproximada ({p.precisao})
                      </p>
                    )}
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 240 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>
                      {p.rotulo || "Local de entrega"}
                    </p>
                    <p style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
                      {p.endereco}
                    </p>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      {p.atas > 0 && (
                        <div>
                          <strong>{p.atas}</strong> ata{p.atas !== 1 ? "s" : ""}
                        </div>
                      )}
                      {p.contratos > 0 && (
                        <div>
                          <strong>{p.contratos}</strong> contrato{p.contratos !== 1 ? "s" : ""}
                        </div>
                      )}
                      {p.empenhos > 0 && (
                        <div>
                          <strong>{p.empenhos}</strong> empenho{p.empenhos !== 1 ? "s" : ""}
                        </div>
                      )}
                      {p.orgaos.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#666" }}>
                          {p.orgaos.join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {vista === "EMPRESAS" && pinsEmpresas?.map((p, idx) => {
            const numero = idx + 1;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const icone = iconFactory({
              cor: "#3F638F",
              raio: 14,
              numero,
            }) as any;
            return (
              <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icone}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div style={{ minWidth: 220 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>
                      <span style={{ display: "inline-block", minWidth: 18, marginRight: 6, padding: "0 6px", background: "#3F638F", color: "white", borderRadius: 9, fontSize: 11 }}>{numero}</span>
                      {p.nome}
                    </p>
                    <p style={{ fontSize: 11, color: "#666" }}>CNPJ {p.cnpj}</p>
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: 240 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>{p.nome}</p>
                    <p style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>
                      CNPJ {p.cnpj}
                    </p>
                    <p style={{ fontSize: 11, color: "#666" }}>{p.endereco}</p>
                    {p.precisao && p.precisao !== "exact" && (
                      <p style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
                        Localização aproximada ({p.precisao})
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
