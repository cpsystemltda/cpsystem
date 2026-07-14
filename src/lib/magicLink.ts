import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// MagicLink: token URL-safe pra login sem senha (Regina 13/07 — pra Leo
// migrar). Expira em 48h por default. REUTILIZAVEL dentro do TTL — Regina
// 14/07: cliente pode clicar varias vezes (webview WA vs browser, retry
// se travou algo, etc). usadoEm guarda a PRIMEIRA ativacao pra auditoria
// mas nao bloqueia reuso.
const MAGIC_LINK_TTL_MS = 48 * 60 * 60 * 1000;

export async function gerarMagicLink(opts: {
  usuarioId: string;
  motivo: string;
  criadoPor?: string;
  ttlMs?: number;
}): Promise<{ token: string; expiraEm: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + (opts.ttlMs ?? MAGIC_LINK_TTL_MS));
  await prisma.magicLink.create({
    data: {
      token,
      usuarioId: opts.usuarioId,
      motivo: opts.motivo,
      criadoPor: opts.criadoPor,
      expiraEm,
    },
  });
  return { token, expiraEm };
}

// Ativa o magic link: valida validade e retorna usuario. REUTILIZAVEL —
// so bloqueia se expirado. Marca usadoEm na PRIMEIRA ativacao (auditoria),
// mas nao bloqueia usos subsequentes.
export async function consumirMagicLink(token: string): Promise<{ usuarioId: string; motivo: string } | null> {
  const link = await prisma.magicLink.findUnique({ where: { token } });
  if (!link) return null;
  if (link.expiraEm < new Date()) return null;
  if (!link.usadoEm) {
    await prisma.magicLink.update({
      where: { id: link.id },
      data: { usadoEm: new Date() },
    });
  }
  return { usuarioId: link.usuarioId, motivo: link.motivo };
}

export function urlDoMagicLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://cpsystem.app.br";
  return `${base.replace(/\/$/, "")}/entrar/magic/${token}`;
}
