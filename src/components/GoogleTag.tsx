"use client";

import Script from "next/script";
import { useEffect } from "react";
import {
  COOKIE_ATRIBUICAO,
  DIAS_ATRIBUICAO,
  desserializar,
  lerAtribuicaoDaUrl,
  serializar,
  temAlgo,
} from "@/lib/atribuicao";

export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Tag do Google (gtag.js) + captura de atribuicao.
 *
 * Fica no layout raiz pra cobrir tanto o site publico quanto o app — o clique
 * do anuncio cai na home, mas o cadastro acontece varias telas depois, e o
 * gclid precisa sobreviver a esse caminho todo.
 *
 * Sem NEXT_PUBLIC_GOOGLE_ADS_ID configurado o componente nao renderiza nada,
 * entao ambiente local e preview nao poluem os dados da campanha.
 */
export function GoogleTag() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const daUrl = lerAtribuicaoDaUrl(window.location.search);
    if (!temAlgo(daUrl)) return;
    // Primeiro clique vence: se a pessoa ja tinha vindo de um anuncio antes,
    // manter a origem original evita que uma visita direta posterior apague o
    // credito da campanha que realmente trouxe o cadastro.
    const atual = desserializar(lerCookie(COOKIE_ATRIBUICAO));
    if (atual.gclid && daUrl.gclid && atual.gclid !== daUrl.gclid) {
      // clique novo de anuncio novo: o mais recente e o que o Google atribui
      gravarCookie(COOKIE_ATRIBUICAO, serializar({ ...atual, ...daUrl }));
      return;
    }
    gravarCookie(COOKIE_ATRIBUICAO, serializar({ ...daUrl, ...atual }));
  }, []);

  if (!GOOGLE_ADS_ID) return null;

  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');`}
      </Script>
    </>
  );
}

function lerCookie(nome: string): string | undefined {
  const alvo = `${nome}=`;
  for (const parte of document.cookie.split("; ")) {
    if (parte.startsWith(alvo)) return decodeURIComponent(parte.slice(alvo.length));
  }
  return undefined;
}

function gravarCookie(nome: string, valor: string) {
  const exp = new Date(Date.now() + DIAS_ATRIBUICAO * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${nome}=${encodeURIComponent(valor)}; path=/; expires=${exp}; SameSite=Lax`;
}

/**
 * Dispara um evento de conversao. Chamado do client no momento exato em que a
 * acao aconteceu (cadastro concluido), nao na visita a uma URL — visita mede
 * curiosidade, evento mede resultado.
 */
export function dispararConversao(
  evento: "sign_up" | "purchase",
  dados?: { value?: number; currency?: string; transaction_id?: string },
) {
  if (typeof window === "undefined" || !window.gtag || !GOOGLE_ADS_ID) return;
  window.gtag("event", evento, {
    send_to: GOOGLE_ADS_ID,
    currency: "BRL",
    ...dados,
  });
}
