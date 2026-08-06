import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cinzel } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonte da identidade da marca CP — serif romana com tracking aberto,
// mesma família visual da logo "CONTRATOS PÚBLICOS" original
const cinzel = Cinzel({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CP System — Gestão pós-licitação",
  description: "Plataforma LegalTech para gestão de Atas, Contratos e Empenhos sob a Lei 14.133/2021.",
  applicationName: "CP System",
  appleWebApp: {
    capable: true,
    title: "CP System",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  // Regina 06/08: os icones foram regerados com a logo correta (monograma CP
  // dourado), mas a aba continuava mostrando a REPROVADA — o Chrome guarda
  // favicon num cache proprio que nem hard refresh limpa, e isso valia pra
  // todo visitante que ja tinha entrado no site. Por isso os arquivos mudaram
  // de nome (favicon-32 -> cp-icone-32): URL nova obriga o navegador a baixar.
  // Se um dia trocar a arte de novo, trocar o nome junto.
  icons: {
    icon: [
      { url: "/cp-icone-32.png", sizes: "32x32", type: "image/png" },
      { url: "/cp-icone-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/cp-icone-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        {children}
        <Script id="pwa-sw" strategy="afterInteractive">
          {`if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(){});
            });
          }`}
        </Script>
      </body>
    </html>
  );
}
