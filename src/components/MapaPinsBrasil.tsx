"use client";

import { useEffect, useMemo, useState } from "react";
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
  cnpjDestaque,
}: {
  pins: PinMapa[];
  // Quando fornecido, habilita o toggle Sedes/Entregas no canto do mapa.
  pinsEntregas?: PinEntregaMapa[];
  cnpjDestaque?: string | null;
}) {
  // Default = satélite (decisão Regina). Persiste preferência por usuário
  // pra não regredir a cada navegação. Leitura do localStorage só ocorre
  // no client (depois do mount) pra evitar mismatch de SSR.
  const [tileSet, setTileSet] = useState<"mapa" | "satelite">("satelite");
  const [vista, setVista] = useState<"SEDES" | "ENTREGAS">("SEDES");
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
  const [LeafletIcon, setLeafletIcon] = useState<{
    icon: unknown;
    iconHover: unknown;
    iconDestaque: unknown;
    iconEntrega: unknown;
  } | null>(null);

  // Configura ícones Leaflet só no client (acessa window/document).
  useEffect(() => {
    import("leaflet").then((L) => {
      function fazerIcone(cor: string, raio: number) {
        const svg = `
          <svg width="${raio * 2}" height="${raio * 2 + 6}" viewBox="0 0 ${raio * 2} ${raio * 2 + 6}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${raio}" cy="${raio}" r="${raio - 1}" fill="${cor}" stroke="white" stroke-width="2"/>
            <circle cx="${raio}" cy="${raio}" r="${raio / 3}" fill="white"/>
          </svg>
        `;
        return L.divIcon({
          html: svg,
          className: "",
          iconSize: [raio * 2, raio * 2 + 6],
          iconAnchor: [raio, raio],
          popupAnchor: [0, -raio],
        });
      }
      setLeafletIcon({
        icon: fazerIcone("#7a5c1a", 11),
        iconHover: fazerIcone("#A88947", 13),
        iconDestaque: fazerIcone("#A88947", 15),
        // Verde-menta pra distinguir entregas das sedes
        iconEntrega: fazerIcone("#1f6f55", 11),
      });
    });
  }, []);

  // Bounds iniciais: depende da vista atual. Cada conjunto de pins tem seu
  // próprio enquadramento — útil quando entregas estão em DF e sedes em GO.
  const pinsAtivos = vista === "ENTREGAS" ? (pinsEntregas ?? []) : pins;
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

  if (pins.length === 0 && (pinsEntregas?.length ?? 0) === 0) {
    return (
      <div
        className="grid h-[360px] place-items-center rounded-2xl text-sm"
        style={{
          color: "var(--text-mute)",
          background: "rgba(15,14,12,0.03)",
          border: "0.5px solid var(--hairline)",
        }}
      >
        Carregando geolocalizações…
      </div>
    );
  }

  if (!LeafletIcon) {
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
      {/* Controles flutuantes — Sedes/Entregas à esquerda, Mapa/Satélite à direita */}
      {pinsEntregas && pinsEntregas.length > 0 && (
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
            title="Sedes dos órgãos atendidos"
          >
            Sedes ({pins.length})
          </button>
          <button
            type="button"
            onClick={() => setVista("ENTREGAS")}
            className="px-3 py-1.5 transition"
            style={{
              background: vista === "ENTREGAS" ? "var(--mint-deep)" : "transparent",
              color: vista === "ENTREGAS" ? "white" : "var(--text)",
              borderRadius: "0 6px 6px 0",
            }}
            title="Locais de entrega cadastrados"
          >
            Entregas ({pinsEntregas.length})
          </button>
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
        <MarkerClusterGroup chunkedLoading>
          {vista === "SEDES" && pins.map((p) => {
            const isDestaque = cnpjDestaque === p.cnpj;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const icone = (isDestaque ? LeafletIcon.iconDestaque : LeafletIcon.icon) as any;
            return (
              <Marker key={p.cnpj} position={[p.latitude, p.longitude]} icon={icone}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div style={{ minWidth: 200 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>{p.nome}</p>
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
          {vista === "ENTREGAS" && pinsEntregas?.map((p) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const icone = LeafletIcon.iconEntrega as any;
            return (
              <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icone}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <div style={{ minWidth: 220 }}>
                    <p style={{ fontWeight: 800, marginBottom: 4 }}>
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
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
