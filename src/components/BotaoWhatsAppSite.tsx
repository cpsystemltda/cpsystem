"use client";

import { linkWhatsAppSuporte, whatsappFormatado } from "@/lib/contatosCpSystem";

/**
 * Botão flutuante de WhatsApp nas páginas públicas (Regina 25/08).
 *
 * Quem chega pelo anúncio e trava — em dúvida no preço, no cadastro, no cartão —
 * hoje não tem para onde perguntar sem sair do site. Este botão abre a conversa
 * no WhatsApp Business do CP System (11 97061-9434), com o texto já iniciado
 * pra pessoa não precisar formular a pergunta do zero.
 *
 * O número vem de `contatosCpSystem` de propósito: é a fonte única, e foi criada
 * justamente porque telefone inventado já foi parar em produção uma vez.
 */
export function BotaoWhatsAppSite({
  mensagem = "Olá! Vim pelo site do CP System e quero saber mais sobre a plataforma.",
}: {
  mensagem?: string;
}) {
  return (
    <a
      href={linkWhatsAppSuporte(mensagem)}
      target="_blank"
      rel="noreferrer"
      aria-label={`Falar com o CP System no WhatsApp ${whatsappFormatado()}`}
      title={`WhatsApp ${whatsappFormatado()}`}
      className="group fixed bottom-6 left-6 z-[70] inline-flex items-center gap-3 rounded-full py-3 pl-3 pr-5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-2xl"
      style={{
        background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
        boxShadow: "0 8px 24px -4px rgba(18,140,126,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
      }}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20">
        {/* Ícone do WhatsApp em SVG — sem depender de biblioteca externa. */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23z" />
        </svg>
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">
          Fale com a gente
        </span>
        <span className="text-[13px] font-extrabold whitespace-nowrap">WhatsApp</span>
      </span>
    </a>
  );
}
