"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, MessageSquare } from "lucide-react";

// Botão flutuante (FAB) no canto inferior direito, presente em todas as
// telas autenticadas — leva direto pro chat /iasystem.
//
// Estados visuais:
//   - colapsado (default): só o ícone + label curto "Tire suas dúvidas"
//   - hover: expande mostrando o CTA completo
//   - na própria /iasystem: NÃO renderiza (evita redundância)
export function FlutuanteIAsystem() {
  const pathname = usePathname();
  if (pathname?.startsWith("/iasystem")) return null;

  return (
    <Link
      href="/iasystem"
      aria-label="Abrir IAsystem — assistente jurídico"
      className="group fixed bottom-6 right-6 z-[60] inline-flex items-center gap-3 rounded-full pl-3 pr-5 py-3 text-sm font-bold text-white shadow-lg transition-all hover:shadow-2xl hover:scale-105"
      style={{
        background: "linear-gradient(135deg, #8E73E0 0%, #6B4FC9 100%)",
        boxShadow:
          "0 8px 24px -4px rgba(110, 78, 209, 0.45), 0 2px 8px rgba(110, 78, 209, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
      }}
    >
      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20">
        <Sparkles className="h-4 w-4" />
        {/* Halo pulsante via animate-ping do Tailwind */}
        <span className="absolute inset-0 rounded-full bg-white/30 animate-ping opacity-60" />
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">
          IAsystem
        </span>
        <span className="text-[13px] font-extrabold whitespace-nowrap">
          Tire suas dúvidas
        </span>
      </span>
      {/* Tooltip expandido no hover */}
      <span className="ml-1 hidden items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap group-hover:inline-flex">
        <MessageSquare className="h-3 w-3" />
        Lei 14.133 em segundos
      </span>
    </Link>
  );
}
