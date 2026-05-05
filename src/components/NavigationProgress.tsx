"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Inicia barra ao clicar em qualquer link interno
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as Element).closest("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto")) return;
      if (href === pathname) return;

      clearTimeout(timerRef.current);
      const bar = barRef.current;
      if (!bar) return;
      bar.style.transition = "none";
      bar.style.width = "0%";
      bar.style.opacity = "1";
      // Pequeno delay para o reset de CSS ser aplicado
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.transition = "width 1s ease-out";
          bar.style.width = "70%";
        });
      });
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  // Conclui barra quando pathname muda (página nova carregou)
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = "width 200ms ease-out, opacity 300ms ease 200ms";
    bar.style.width = "100%";
    timerRef.current = setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => { bar.style.width = "0"; bar.style.opacity = "1"; }, 400);
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [pathname]);

  return (
    <div
      ref={barRef}
      className="fixed left-0 top-0 z-[9999] h-[3px] bg-blue-500"
      style={{ width: "0", opacity: "0", pointerEvents: "none" }}
    />
  );
}
