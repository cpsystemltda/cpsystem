import { NextRequest, NextResponse } from "next/server";
import { enviarTexto } from "@/lib/whatsapp";

// POST { telefone, mensagem, idempotencyKey } -> envia UMA vez.
// idempotencyKey OBRIGATORIA — proteção contra reenvio acidental.
// Cache em memoria por 10min. Se a mesma key for chamada 2x, 2a chamada retorna o resultado cached.

const cache = new Map<string, { ts: number; result: Record<string, unknown> }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { telefone?: string; mensagem?: string; idempotencyKey?: string }
    | null;
  if (!body?.telefone || !body?.mensagem || !body?.idempotencyKey) {
    return NextResponse.json({ erro: "telefone, mensagem e idempotencyKey sao obrigatorios" }, { status: 400 });
  }

  // Idempotencia — se ja processado nos ultimos 10min, retorna resultado anterior
  const cached = cache.get(body.idempotencyKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.result, fromCache: true });
  }

  try {
    const r = await enviarTexto(body.telefone, body.mensagem);
    const result = { ok: true, messageId: r.messageId };
    cache.set(body.idempotencyKey, { ts: Date.now(), result });
    return NextResponse.json(result);
  } catch (err) {
    const result = { ok: false, erro: err instanceof Error ? err.message : String(err) };
    // Nao cacheia erro — pode retentar depois de resolver
    return NextResponse.json(result, { status: 500 });
  }
}
