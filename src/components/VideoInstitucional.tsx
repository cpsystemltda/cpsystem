"use client";

import { useState } from "react";
import { Play } from "lucide-react";

// Player do video institucional, extraido da landing pra ser reutilizavel
// (Regina 08/08: a pagina /para-analistas precisa do mesmo video oficial).
//
// Hospedado no Vercel Blob em vez de public/: o master tinha 576 MB
// (1080p60 a 40 Mbps) e foi reencodado pra 23 MB mantendo 1080p, porque e um
// tour da tela do sistema e baixar a resolucao deixaria a UI ilegivel.
// preload="none" + poster do primeiro frame: quem nao da play nao baixa nada.
export const VIDEO_INSTITUCIONAL =
  "https://daci3hzdnsf8gryv.public.blob.vercel-storage.com/institucional/cp-system-tour.mp4";
// Versao leve do mesmo tour, para envio por WhatsApp (Regina 14/08). O arquivo
// de 23MB do site era recusado na entrega — o WhatsApp corta video acima de
// ~16MB. Este tem 9,8MB e a mesma duracao.
export const VIDEO_INSTITUCIONAL_WHATSAPP =
  "https://daci3hzdnsf8gryv.public.blob.vercel-storage.com/institucional/cp-tour-min.mp4";
export const VIDEO_INSTITUCIONAL_POSTER =
  "https://daci3hzdnsf8gryv.public.blob.vercel-storage.com/institucional/cp-system-tour-poster.jpg";

export function VideoInstitucional({ rotulo = "Tour guiado · 2 min" }: { rotulo?: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative w-full">
      {/* Moldura em L — mesma da landing */}
      <span aria-hidden className="absolute -left-3 -top-3 h-14 w-14 rounded-tl-2xl"
        style={{ borderTop: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -right-3 -top-3 h-14 w-14 rounded-tr-2xl"
        style={{ borderTop: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -bottom-3 -left-3 h-14 w-14 rounded-bl-2xl"
        style={{ borderBottom: "2px solid var(--primary)", borderLeft: "2px solid var(--primary)" }} />
      <span aria-hidden className="absolute -bottom-3 -right-3 h-14 w-14 rounded-br-2xl"
        style={{ borderBottom: "2px solid var(--primary)", borderRight: "2px solid var(--primary)" }} />

      <div
        className="glass relative w-full overflow-hidden rounded-[20px]"
        style={{ aspectRatio: "16 / 9" }}
      >
        {!aberto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={VIDEO_INSTITUCIONAL_POSTER}
              alt="Tour guiado pelo CP System"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(15,14,12,0.28), rgba(15,14,12,0.52))" }}
            />
            <button
              type="button"
              onClick={() => setAberto(true)}
              className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-4 transition-transform hover:scale-[1.01]"
              aria-label="Assistir vídeo institucional"
            >
              <span
                aria-hidden
                className="absolute h-[160px] w-[160px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(212,175,55,0.42) 0%, rgba(212,175,55,0) 70%)" }}
              />
              <span
                className="relative flex h-[96px] w-[96px] items-center justify-center rounded-full"
                style={{
                  background: "linear-gradient(135deg, #E8C875 0%, #D4AF37 50%, #A88947 100%)",
                  boxShadow: "0 16px 38px -6px rgba(168,137,71,0.6), inset 0 1px 0 rgba(255,255,255,0.55)",
                }}
              >
                <Play
                  className="h-12 w-12 translate-x-[3px]"
                  style={{ color: "#FFFEF9", fill: "#FFFEF9" }}
                  strokeWidth={2.2}
                />
              </span>
              <span
                className="relative text-[11px] font-bold uppercase"
                style={{
                  color: "#FFFEF9",
                  letterSpacing: "0.32em",
                  textShadow: "0 2px 12px rgba(15,14,12,0.75)",
                }}
              >
                {rotulo}
              </span>
            </button>
          </>
        )}

        {aberto && (
          <video
            className="absolute inset-0 z-[2] h-full w-full bg-black"
            src={VIDEO_INSTITUCIONAL}
            poster={VIDEO_INSTITUCIONAL_POSTER}
            controls
            autoPlay
            playsInline
            preload="none"
            style={{ objectFit: "contain" }}
          />
        )}
      </div>
    </div>
  );
}
