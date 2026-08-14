import type { CapacitorConfig } from "@capacitor/cli";

// Estrategia de wrapping: o app carrega diretamente https://cpsystem.app.br
// dentro do webview nativo. Vantagem: qualquer atualizacao publicada em
// producao aparece na hora, sem submissao a loja. Cuidado com App Store
// Review Guideline 4.2 (Minimum Functionality) — apps que sao "so um site"
// sao rejeitados. Mitigacao: splash nativa + status bar customizada +
// push nativo + capabilities offline via service worker que ja existe.

const config: CapacitorConfig = {
  appId: "br.com.cpsystem.app",
  appName: "CP System",
  webDir: "capacitor-app/www",
  server: {
    url: "https://cpsystem.app.br",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    // Barra de status escura (theme_color do PWA e navy #1e3a5f)
    backgroundColor: "#1e3a5f",
  },
  android: {
    backgroundColor: "#1e3a5f",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#1e3a5f",
      androidSplashResourceName: "splash",
      showSpinner: true,
      spinnerColor: "#d4af37",
    },
    StatusBar: {
      backgroundColor: "#1e3a5f",
      style: "DARK",
    },
  },
};

export default config;
