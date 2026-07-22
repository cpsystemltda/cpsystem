import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Sessao pendente 2FA — cookie HMAC-assinado, TTL curto (5 min).
// Regina 22/07 (SEG P1). Sem DB round-trip; se AUTH_SECRET vazar, tudo cai.

const COOKIE = "cp_pending_2fa";
const TTL_MS = 5 * 60 * 1000; // 5 minutos — cliente digita codigo em segundos, sobra bastante

type Payload = { uid: string; iat: number };

function secret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET nao configurado");
  return Buffer.from(s);
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64url");
}

function assinar(payload: Payload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

function verificar(token: string): Payload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const esperado = createHmac("sha256", secret()).update(body).digest();
  const recebido = Buffer.from(sig, "base64url");
  if (esperado.length !== recebido.length) return null;
  if (!timingSafeEqual(esperado, recebido)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
    if (typeof payload.uid !== "string" || typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function criarPending2FA(usuarioId: string): Promise<void> {
  const token = assinar({ uid: usuarioId, iat: Date.now() });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_MS / 1000,
    path: "/",
  });
}

export async function lerPending2FA(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const p = verificar(token);
  return p?.uid ?? null;
}

export async function limparPending2FA(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
