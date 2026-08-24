"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Torna um elemento fixo arrastável pela tela, lembrando onde o usuário largou.
 *
 * Regina 24/08: o balão do IAsystem fica no canto inferior direito e cobria
 * justamente a linha do relatório que ela queria ler — sem jeito de tirar da
 * frente a não ser fechando o assistente.
 *
 * Detalhes que fazem diferença aqui:
 * - Arrastar não pode virar clique. Só depois de 4px de movimento a interação
 *   é tratada como arrasto, e o clique seguinte é descartado — senão todo
 *   arrasto abriria (ou fecharia) o chat no fim.
 * - A posição é limitada à janela, inclusive quando ela é redimensionada: caso
 *   contrário o elemento "some" fora da tela e o usuário não tem como trazer de
 *   volta.
 * - Sem posição salva, o elemento fica onde o CSS o colocou. Isso mantém o
 *   render do servidor igual ao do cliente (nada de hidratação quebrada) e
 *   preserva o canto de sempre pra quem nunca arrastou.
 */

export type Posicao = { x: number; y: number };

const MARGEM = 8;

function limitarNaJanela(p: Posicao, el: HTMLElement | null): Posicao {
  if (typeof window === "undefined") return p;
  const largura = el?.offsetWidth ?? 240;
  const altura = el?.offsetHeight ?? 72;
  const maxX = Math.max(MARGEM, window.innerWidth - largura - MARGEM);
  const maxY = Math.max(MARGEM, window.innerHeight - altura - MARGEM);
  return {
    x: Math.min(Math.max(p.x, MARGEM), maxX),
    y: Math.min(Math.max(p.y, MARGEM), maxY),
  };
}

export function useArrastavel<T extends HTMLElement>(chave: string) {
  const alvoRef = useRef<T | null>(null);
  const [pos, setPos] = useState<Posicao | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const arrastouRef = useRef(false);
  const origemRef = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // Posição salva (por usuário, no navegador dele).
  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(chave);
      if (!bruto) return;
      const p = JSON.parse(bruto) as Posicao;
      if (typeof p?.x === "number" && typeof p?.y === "number") {
        setPos(limitarNaJanela(p, alvoRef.current));
      }
    } catch {
      // Navegador sem localStorage (aba anônima, storage bloqueado): segue
      // com a posição padrão do CSS.
    }
  }, [chave]);

  const aoPressionar = useCallback((e: React.PointerEvent) => {
    const el = alvoRef.current;
    if (!el) return;
    // Botão direito não arrasta.
    if (e.button !== 0) return;
    const r = el.getBoundingClientRect();
    origemRef.current = { px: e.clientX, py: e.clientY, x: r.left, y: r.top };
    arrastouRef.current = false;
    setArrastando(true);
  }, []);

  useEffect(() => {
    if (!arrastando) return;

    function mover(e: PointerEvent) {
      const o = origemRef.current;
      if (!o) return;
      const dx = e.clientX - o.px;
      const dy = e.clientY - o.py;
      if (!arrastouRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      arrastouRef.current = true;
      e.preventDefault();
      setPos(limitarNaJanela({ x: o.x + dx, y: o.y + dy }, alvoRef.current));
    }

    function soltar() {
      setArrastando(false);
      origemRef.current = null;
      if (!arrastouRef.current) return;
      setPos((atual) => {
        if (atual) {
          try {
            window.localStorage.setItem(chave, JSON.stringify(atual));
          } catch {
            // sem storage: a posição vale só nesta sessão
          }
        }
        return atual;
      });
      // Deixa o clique sintético que vem logo depois do "soltar" ser
      // descartado antes de liberar o flag.
      setTimeout(() => {
        arrastouRef.current = false;
      }, 0);
    }

    window.addEventListener("pointermove", mover, { passive: false });
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  }, [arrastando, chave]);

  // Janela menor não pode engolir o elemento.
  useEffect(() => {
    function aoRedimensionar() {
      setPos((atual) => (atual ? limitarNaJanela(atual, alvoRef.current) : atual));
    }
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  /** Use no onClick pra ignorar o clique que fecha um arrasto. */
  const foiArrasto = useCallback(() => arrastouRef.current, []);

  const estilo: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : {};

  return { alvoRef, aoPressionar, arrastando, foiArrasto, estilo };
}
