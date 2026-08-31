"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Share, Smartphone, X, Plus } from "lucide-react";

/**
 * Convida a instalar o CP System no celular.
 *
 * Regina 31/08: o Léo descobriu SOZINHO que dava pra instalar e passou a usar
 * como aplicativo. O sistema é um PWA desde 30/07 — o que faltava era alguém
 * contar isso pros clientes.
 *
 * Regras que evitam o convite virar incômodo:
 *
 * - Só no celular. No computador, instalar não muda nada e o aviso seria ruído.
 * - Some pra quem já instalou (o app abre em `standalone`, dá pra detectar).
 * - Aparece uma vez; quem dispensa não vê de novo naquele aparelho.
 * - A memória é por APARELHO, não por conta: instalar é um ato do celular, e a
 *   mesma pessoa pode querer instalar no aparelho novo depois.
 *
 * No Android o navegador entrega um evento que permite instalar com um toque.
 * No iPhone a Apple não oferece isso — só o caminho manual pelo menu de
 * compartilhar, então ali o convite ensina em vez de instalar.
 */

const CHAVE = "cp_convite_instalar_dispensado";

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function ConviteInstalarApp() {
  const [visivel, setVisivel] = useState(false);
  const [ehIos, setEhIos] = useState(false);
  const [eventoAndroid, setEventoAndroid] = useState<EventoInstalacao | null>(null);

  useEffect(() => {
    // Já instalado? O app aberto pela tela de início roda em standalone.
    const instalado =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      // iOS antigo expõe isto em vez do display-mode.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (instalado) return;

    // No computador o convite não faz sentido.
    const telaPequena = window.matchMedia?.("(max-width: 820px)")?.matches;
    const toque = navigator.maxTouchPoints > 0;
    if (!telaPequena || !toque) return;

    try {
      if (window.localStorage.getItem(CHAVE) === "1") return;
    } catch {
      // Navegador sem armazenamento (aba anônima): mostra assim mesmo.
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setEhIos(ios);

    // Android/Chrome avisa quando a instalação é possível.
    function capturar(e: Event) {
      e.preventDefault();
      setEventoAndroid(e as EventoInstalacao);
      setVisivel(true);
    }
    window.addEventListener("beforeinstallprompt", capturar);

    // No iPhone o evento nunca chega — mostramos depois de um respiro, pra não
    // atropelar a pessoa no primeiro segundo em que ela abre a tela.
    const t = ios ? window.setTimeout(() => setVisivel(true), 4000) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      if (t) window.clearTimeout(t);
    };
  }, []);

  function dispensar() {
    setVisivel(false);
    try {
      window.localStorage.setItem(CHAVE, "1");
    } catch {
      /* sem armazenamento: volta a aparecer na próxima visita, e tudo bem */
    }
  }

  async function instalarNoAndroid() {
    if (!eventoAndroid) return;
    await eventoAndroid.prompt();
    await eventoAndroid.userChoice.catch(() => null);
    dispensar();
  }

  if (!visivel || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 90 }}
      role="dialog"
      aria-label="Instalar o CP System no celular"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50">
            <Smartphone className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">
              Deixe o CP System na tela do seu celular
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Abre em tela cheia, direto no ícone — e os avisos de prazo ficam a um toque.
            </p>

            {ehIos ? (
              <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">Como fazer, leva 10 segundos:</p>
                <p className="mt-1 flex flex-wrap items-center gap-1">
                  Toque em <Share className="inline h-3.5 w-3.5 text-blue-600" aria-label="compartilhar" />
                  <strong>Compartilhar</strong>, na barra do Safari, e escolha
                  <Plus className="inline h-3.5 w-3.5" aria-hidden />
                  <strong>Adicionar à Tela de Início</strong>.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={instalarNoAndroid}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Instalar agora
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={dispensar}
            aria-label="Agora não"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
