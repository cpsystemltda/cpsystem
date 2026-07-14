import { NextRequest, NextResponse } from "next/server";

// Configura webhook Z-API "ao receber mensagem" apontando pro nosso endpoint.
// Regina 14/07 pediu resposta em tempo real — se webhook nao ta configurado,
// nao chega msg pra IA processar.
//
// Docs Z-API: https://developer.z-api.io/webhooks/on-message-received
//   PUT /instances/{id}/token/{tok}/update-webhook-received
//   body: { value: "https://cpsystem.app.br/api/webhooks/zapi-inbound" }

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });

  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });

  const base = `https://api.z-api.io/instances/${inst}/token/${tok}`;
  const targetUrl = `${(process.env.NEXT_PUBLIC_BASE_URL || "https://cpsystem.app.br").replace(/\/$/, "")}/api/webhooks/zapi-inbound`;

  // Configura vários webhooks Z-API que a gente quer receber.
  // Tenta multiplos formatos porque a Z-API mudou API entre versoes.
  const configs = [
    { path: "update-webhook-received", body: { value: targetUrl } }, // formato antigo
    { path: "update-webhook-message-status", body: { value: targetUrl } },
    { path: "update-webhook-delivery", body: { value: targetUrl } },
    // Formato novo — Z-API v3+ usa update-webhook-received-message
    { path: "update-webhook-received-message", body: { value: targetUrl } },
    { path: "update-webhook-message-received", body: { value: targetUrl } },
    // Formato mais generico
    { path: "webhook", body: { value: targetUrl } },
  ];

  const results: Record<string, unknown>[] = [];
  for (const c of configs) {
    try {
      const r = await fetch(`${base}/${c.path}`, {
        method: "PUT",
        headers: { "Client-Token": client, "Content-Type": "application/json" },
        body: JSON.stringify(c.body),
      });
      const j = await r.json();
      results.push({ path: c.path, httpStatus: r.status, response: j });
    } catch (err) {
      results.push({ path: c.path, erro: err instanceof Error ? err.message : String(err) });
    }
  }

  // Le config atual pra confirmar
  const readback = await fetch(`${base}/webhook-received`, { headers: { "Client-Token": client } })
    .then((r) => r.json())
    .catch((e) => ({ erro: String(e) }));

  return NextResponse.json({ targetUrl, results, readback });
}

// GET pra ver a config atual sem modificar
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });
  const base = `https://api.z-api.io/instances/${inst}/token/${tok}`;

  const [received, delivery, status] = await Promise.all([
    fetch(`${base}/webhook-received`, { headers: { "Client-Token": client } }).then((r) => r.json()).catch((e) => ({ erro: String(e) })),
    fetch(`${base}/webhook-delivery`, { headers: { "Client-Token": client } }).then((r) => r.json()).catch((e) => ({ erro: String(e) })),
    fetch(`${base}/webhook-message-status`, { headers: { "Client-Token": client } }).then((r) => r.json()).catch((e) => ({ erro: String(e) })),
  ]);

  return NextResponse.json({ received, delivery, status });
}
