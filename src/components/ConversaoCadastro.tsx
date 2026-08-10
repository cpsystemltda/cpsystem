"use client";

import { useEffect } from "react";
import { dispararConversao } from "@/components/GoogleTag";

const JA_CONTADO = "cp_conv_signup";

/**
 * Dispara a conversao "cadastro" no Google Ads.
 *
 * Renderizado no dashboard/painel logo apos o signup (a server action redireciona
 * com `?novo=1`). Medir aqui, e nao na visita a /signup, e o que diferencia
 * "alguem abriu o formulario" de "alguem terminou o cadastro" — so o segundo e
 * resultado.
 *
 * O sessionStorage evita contar de novo se a pessoa der F5 na mesma URL.
 */
export function ConversaoCadastro({ valor }: { valor?: number }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(JA_CONTADO)) return;
    sessionStorage.setItem(JA_CONTADO, "1");
    dispararConversao("sign_up", valor ? { value: valor } : undefined);
    // Limpa o ?novo=1 da URL pra nao ficar no historico nem em link compartilhado.
    const url = new URL(window.location.href);
    if (url.searchParams.has("novo")) {
      url.searchParams.delete("novo");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  }, [valor]);

  return null;
}
