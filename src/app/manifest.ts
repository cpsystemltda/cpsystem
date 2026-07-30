import type { MetadataRoute } from "next";

// PWA manifest — permite instalação no iOS/Android via "Adicionar à tela de
// início". Regina 30/07: sem loja, sem cadastro Apple Developer, deploy é
// automático junto do site. Suficiente pro cliente-alvo (empresas
// fornecedoras que já usam o portal no navegador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CP System — Contratos Públicos",
    short_name: "CP System",
    description:
      "Gestão de Atas, Contratos e Empenhos sob a Lei 14.133/2021 — para empresas fornecedoras e analistas de licitação.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1e3a5f",
    lang: "pt-BR",
    scope: "/",
    icons: [
      { src: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { src: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "productivity", "finance"],
  };
}
