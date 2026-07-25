// Contatos oficiais do CP System — fonte única de verdade.
// Regina 25/07/2026: hardcoded fake (tel 61 3900-0000, suporte@contratospublicos.com.br,
// "Suporte Premium") apareceu em produção. Nunca mais.
//
// Prioridade: env var > default aqui. Assim Regina troca sem redeploy.
export const CONTATOS_CP_SYSTEM = {
  whatsappBusiness: process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP || "5511970619434",
  email: process.env.NEXT_PUBLIC_SUPORTE_EMAIL || "contato@cpsystem.app.br",
} as const;

// Link direto pra abrir conversa no WA
export function linkWhatsAppSuporte(msg?: string): string {
  const base = `https://wa.me/${CONTATOS_CP_SYSTEM.whatsappBusiness}`;
  return msg ? `${base}?text=${encodeURIComponent(msg)}` : base;
}

// Link mailto
export function linkEmailSuporte(assunto?: string): string {
  const base = `mailto:${CONTATOS_CP_SYSTEM.email}`;
  return assunto ? `${base}?subject=${encodeURIComponent(assunto)}` : base;
}

// Formatado pra display humano do WA (11 97061-9434)
export function whatsappFormatado(): string {
  const n = CONTATOS_CP_SYSTEM.whatsappBusiness.replace(/^55/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  return n;
}
