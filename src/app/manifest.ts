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
    // Regina 31/08: "cliquei no aplicativo e demorou uma eternidade pra abrir".
    // A causa era esta linha: o icone abria a PAGINA DE VENDAS — com video,
    // animacoes e imagens pesadas — e so depois a pessoa navegava pro sistema.
    // Quem instalou o app ja e cliente; ele tem que cair direto no painel.
    // Quem nao estiver logado e mandado pro login pelo proprio sistema.
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1e3a5f",
    lang: "pt-BR",
    scope: "/",
    // Nomes trocados junto com a troca da arte (Regina 06/08) — ver comentario
    // em layout.tsx: URL nova e o que obriga navegador e PWA ja instalado a
    // buscar o icone de novo em vez de servir o antigo do cache.
    icons: [
      { src: "/cp-icone-16.png", sizes: "16x16", type: "image/png" },
      { src: "/cp-icone-32.png", sizes: "32x32", type: "image/png" },
      { src: "/cp-icone-180.png", sizes: "180x180", type: "image/png" },
      { src: "/cp-icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/cp-icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/cp-icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "productivity", "finance"],
  };
}
