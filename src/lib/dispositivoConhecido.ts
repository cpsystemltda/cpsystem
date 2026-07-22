import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dispararNotificacao } from "@/lib/whatsapp";

// Alerta de login em dispositivo novo — Regina 22/07/2026 (SEG P1,
// feedback-seguranca-zero-gap).
//
// Fingerprint = SHA-256 do user-agent completo. Nao inclui IP: cliente
// muda de rede o tempo todo (wifi/4G/hotspot) e disparariamos alerta a
// cada troca — barulho ruim. Mudanca REAL de dispositivo tem UA diferente
// (Safari/iOS vs Chrome/macOS vs app nativo, etc). Falso positivo: cliente
// atualiza browser (UA muda de versao) — vai receber 1 alerta e o UA novo
// vira conhecido.
//
// Regra: PRIMEIRO login pos-signup grava device SEM notificar (senao spam
// no proprio signup). Segundo login com fingerprint nova (= trocou de
// device/browser) dispara WA.

export function fingerprintUserAgent(userAgent: string | null): string {
  const raw = (userAgent || "unknown").slice(0, 500);
  return createHash("sha256").update(raw).digest("hex");
}

// Retorna:
//   - "primeiro_dispositivo" — nao tinha nenhum, so registra (nao notifica)
//   - "conhecido" — ja tinha, so atualiza ultimoLoginEm
//   - "novo" — tinha outros mas esse eh novo → CALLER deve notificar
export async function verificarERegistrarDispositivo(input: {
  usuarioId: string;
  userAgent: string | null;
  ip: string;
}): Promise<"primeiro_dispositivo" | "conhecido" | "novo"> {
  const fp = fingerprintUserAgent(input.userAgent);

  // Ja conhecido?
  const existente = await prisma.dispositivoConhecido.findUnique({
    where: { usuarioId_fingerprint: { usuarioId: input.usuarioId, fingerprint: fp } },
    select: { id: true },
  });
  if (existente) {
    await prisma.dispositivoConhecido.update({
      where: { id: existente.id },
      data: { ultimoLoginEm: new Date(), ipUltimoAcesso: input.ip },
    });
    return "conhecido";
  }

  // Nao conhecido — verifica se eh o primeiro dispositivo do usuario
  const totalAntes = await prisma.dispositivoConhecido.count({
    where: { usuarioId: input.usuarioId },
  });

  await prisma.dispositivoConhecido.create({
    data: {
      usuarioId: input.usuarioId,
      fingerprint: fp,
      ipUltimoAcesso: input.ip,
      userAgentAmostra: (input.userAgent || "").slice(0, 500),
    },
  });

  return totalAntes === 0 ? "primeiro_dispositivo" : "novo";
}

// Formata o user-agent pra exibir na mensagem — extrai o mais relevante
// (browser + OS) sem despejar a string bruta.
function resumoUserAgent(ua: string | null): string {
  if (!ua) return "dispositivo desconhecido";
  const s = ua.toLowerCase();
  const browser =
    s.includes("edg/") ? "Edge" :
    s.includes("chrome/") && !s.includes("chromium") ? "Chrome" :
    s.includes("firefox/") ? "Firefox" :
    s.includes("safari/") && !s.includes("chrome") ? "Safari" :
    "Navegador desconhecido";
  const os =
    s.includes("iphone") ? "iPhone" :
    s.includes("ipad") ? "iPad" :
    s.includes("android") ? "Android" :
    s.includes("mac os") || s.includes("macintosh") ? "Mac" :
    s.includes("windows") ? "Windows" :
    s.includes("linux") ? "Linux" :
    "SO desconhecido";
  return `${browser} · ${os}`;
}

// Dispara WA pro cliente avisando do login em device novo.
// Bypassa o cap diario (usa envio direto) — alerta de seguranca eh critico.
export async function notificarLoginDeviceNovo(input: {
  usuarioId: string;
  telefone: string | null;
  userAgent: string | null;
  ip: string;
  hora: Date;
}): Promise<void> {
  if (!input.telefone) return;

  const horaBrt = input.hora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const resumo = resumoUserAgent(input.userAgent);

  const mensagem =
    `🔐 *Alerta de segurança CP System*\n\n` +
    `Detectamos um login novo na sua conta:\n\n` +
    `📱 Dispositivo: *${resumo}*\n` +
    `🌐 IP: ${input.ip}\n` +
    `🕐 Quando: ${horaBrt}\n\n` +
    `Se foi você, pode ignorar essa mensagem.\n\n` +
    `*Se NÃO foi você:* alguém pode estar tentando acessar sua conta. ` +
    `Troque sua senha imediatamente em https://cpsystem.app.br/esqueci-senha ` +
    `e nos avise respondendo aqui.\n\n` +
    `Contato CP System`;

  try {
    await dispararNotificacao({
      usuarioId: input.usuarioId,
      tipo: "SEGURANCA_LOGIN_NOVO_DEVICE",
      referenciaId: `login-device-novo-${input.hora.toISOString().slice(0, 13)}`,
      mensagem,
      // Alerta de seguranca ignora opt-in e cap diario — se cliente
      // desligou WA, ainda assim dispara. Regina zero-gap.
      bypassCap: true,
    });
  } catch (err) {
    console.error("[dispositivo-novo] falha ao notificar:", err);
    // Nao propaga — nao vamos travar login por falha em WA
  }
}
