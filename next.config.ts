import type { NextConfig } from "next";


// Content-Security-Policy — entra em modo OBSERVACAO (Report-Only) de proposito.
//
// Regina 28/08, item 3 da fila de seguranca. CSP e o cabecalho que mais protege
// e o que mais quebra tela quando escrito no chute: basta esquecer um dominio
// pra um mapa sumir ou um botao parar de funcionar em producao, sem erro
// visivel pro usuario. Em Report-Only o navegador NAO bloqueia nada — so avisa
// o que bloquearia, e esses avisos chegam em /api/csp-report.
//
// Depois de alguns dias sem relato novo, troca-se o nome do cabecalho para
// `Content-Security-Policy` e a politica passa a valer de verdade.
const CSP_OBSERVACAO = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // 'unsafe-inline'/'unsafe-eval': o Next injeta script inline de hidratacao.
  // Apertar isso exige nonce por requisicao — melhoria pra depois de a politica
  // estar valendo.
  // googleads/doubleclick entram porque a tag de conversao do Google Ads carrega
  // por ai. Descobertos no modo observacao: com a politica bloqueando, a medicao
  // da campanha teria parado — justamente o que a gente paga pra ter.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.google.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // Imagens: anexos do proprio armazenamento e os ladrilhos dos dois mapas.
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org https://server.arcgisonline.com https://www.googletagmanager.com https://www.google.com https://www.google.com.br https://googleads.g.doubleclick.net https://*.doubleclick.net",
  // Consultas que o navegador faz: CEP, CNPJ, medicao do Google e o proprio armazenamento.
  "connect-src 'self' https://viacep.com.br https://brasilapi.com.br https://www.googletagmanager.com https://*.google-analytics.com https://*.public.blob.vercel-storage.com https://www.google.com https://www.google.com.br https://*.doubleclick.net https://googleads.g.doubleclick.net",
  "frame-src 'self' https://calendar.google.com",
  // Checkout do gateway abre por formulario.
  "form-action 'self' https://www.asaas.com",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Alinhado com MAX_BYTES de src/lib/uploads.ts (25 MB). Antes era 10 MB
      // e cortava PDFs grandes de aditivos antes de chegar na action — usuario
      // via "deu erro" sem mensagem util.
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Isola a janela de outras origens sem quebrar login por popup.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // Impede que outro site consuma nossos recursos direto.
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          { key: "Content-Security-Policy-Report-Only", value: CSP_OBSERVACAO },
        ],
      },
    ];
  },
};

export default nextConfig;
