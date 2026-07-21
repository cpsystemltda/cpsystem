import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Rate limit de login — Regina 21/07/2026 (SEG P0, feedback-seguranca-zero-gap).
//
// Duas defesas independentes:
//   1) Por EMAIL: 5 falhas em 15 min → bloqueia esse email por 15 min
//   2) Por IP:   20 falhas em 15 min → bloqueia esse IP por 15 min
//
// A regra 1 bloqueia brute force contra 1 conta especifica.
// A regra 2 bloqueia brute force distribuido (varias contas, mesmo IP).
//
// Tentativas com SUCESSO nao zeram o contador — ataque pode ter tentado
// 3x, acertado no 4x e o real dono ainda estar sob risco. Mas o cliente
// nunca se auto-bloqueia porque, ao logar com sucesso, ele deixa de
// tentar. Contador conta so falhas nas ultimas 15 min pra regra 1.

const JANELA_MS = 15 * 60 * 1000;
const LIMITE_FALHAS_POR_EMAIL = 5;
const LIMITE_TENTATIVAS_POR_IP = 20;

export type ResultadoRateLimit =
  | { permitido: true }
  | { permitido: false; motivo: string; retryEmSegundos: number };

// Extrai o IP real do request. Vercel manda em x-forwarded-for
// (primeiro item = cliente original). Fallback pra 'unknown' se nao vier
// — nesse caso, considera 'unknown' como um IP so, o que degrada bem
// (o proprio 'unknown' vira balde de rate limit).
export async function ipDoRequest(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function userAgentDoRequest(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

export async function verificarLimiteLogin(email: string, ip: string): Promise<ResultadoRateLimit> {
  const emailNorm = email.toLowerCase();
  const desde = new Date(Date.now() - JANELA_MS);

  const [falhasPorEmail, tentativasPorIp] = await Promise.all([
    prisma.tentativaLogin.count({
      where: { email: emailNorm, sucesso: false, criadoEm: { gte: desde } },
    }),
    prisma.tentativaLogin.count({
      where: { ip, criadoEm: { gte: desde } },
    }),
  ]);

  if (falhasPorEmail >= LIMITE_FALHAS_POR_EMAIL) {
    return {
      permitido: false,
      motivo: "muitas_tentativas_email",
      retryEmSegundos: await calcularEspera("email", emailNorm),
    };
  }
  if (tentativasPorIp >= LIMITE_TENTATIVAS_POR_IP) {
    return {
      permitido: false,
      motivo: "muitas_tentativas_ip",
      retryEmSegundos: await calcularEspera("ip", ip),
    };
  }
  return { permitido: true };
}

// Retorna o numero de segundos ate a tentativa mais antiga da janela sair
// dela (dando espaco pra proxima). Aproxima "tempo pra desbloquear".
async function calcularEspera(chave: "email" | "ip", valor: string): Promise<number> {
  const desde = new Date(Date.now() - JANELA_MS);
  const maisAntiga = await prisma.tentativaLogin.findFirst({
    where: chave === "email"
      ? { email: valor, sucesso: false, criadoEm: { gte: desde } }
      : { ip: valor, criadoEm: { gte: desde } },
    orderBy: { criadoEm: "asc" },
    select: { criadoEm: true },
  });
  if (!maisAntiga) return 60;
  const expiraEm = maisAntiga.criadoEm.getTime() + JANELA_MS;
  return Math.max(60, Math.ceil((expiraEm - Date.now()) / 1000));
}

export async function registrarTentativa(input: {
  email: string;
  ip: string;
  sucesso: boolean;
  userAgent: string | null;
}): Promise<void> {
  await prisma.tentativaLogin.create({
    data: {
      email: input.email.toLowerCase(),
      ip: input.ip,
      sucesso: input.sucesso,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    },
  });
}

// Cron diario limpa registros com mais de 30 dias
export async function limparTentativasAntigas(): Promise<{ removidas: number }> {
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const r = await prisma.tentativaLogin.deleteMany({
    where: { criadoEm: { lt: limite } },
  });
  return { removidas: r.count };
}

export function mensagemBloqueio(motivo: string, retryEmSegundos: number): string {
  const minutos = Math.ceil(retryEmSegundos / 60);
  if (motivo === "muitas_tentativas_email") {
    return `Muitas tentativas de login pra esse e-mail. Aguarde ${minutos} minuto${minutos > 1 ? "s" : ""} e tente de novo.`;
  }
  if (motivo === "muitas_tentativas_ip") {
    return `Muitas tentativas de login desse dispositivo. Aguarde ${minutos} minuto${minutos > 1 ? "s" : ""} e tente de novo.`;
  }
  return `Login temporariamente bloqueado. Tente em ${minutos} minuto${minutos > 1 ? "s" : ""}.`;
}
