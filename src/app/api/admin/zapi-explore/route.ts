import { NextRequest, NextResponse } from "next/server";

// Explora endpoints Z-API pra descobrir qual retorna mensagens de um chat.
// Regina 14/07: webhook nao dispara, fallback via polling.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const phone = url.searchParams.get("phone") || "556181537113";
  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });
  const base = `https://api.z-api.io/instances/${inst}/token/${tok}`;

  const paths = [
    `chat-messages/${phone}`,
    `chats/${phone}/messages`,
    `chats/${phone}`,
    `messages/${phone}`,
    `chat/${phone}/messages`,
    `chat/${phone}`,
    `chats-messages/${phone}`,
    `last-messages/${phone}`,
    `messages?phone=${phone}`,
    `chat-message?phone=${phone}`,
  ];
  const results: Record<string, unknown>[] = [];
  for (const p of paths) {
    try {
      const r = await fetch(`${base}/${p}`, { headers: { "Client-Token": client } });
      const txt = await r.text();
      results.push({ path: p, httpStatus: r.status, body: txt.slice(0, 400) });
    } catch (err) {
      results.push({ path: p, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ results });
}
