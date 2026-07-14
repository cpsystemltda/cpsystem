import { NextRequest, NextResponse } from "next/server";

// Debug + config do Z-API. Regina 14/07: descobrir por que webhook nao
// dispara.

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });
  const base = `https://api.z-api.io/instances/${inst}/token/${tok}`;

  // Testa MUITOS paths pra descobrir quais existem no plano da instancia
  const testes = [
    "status",
    "webhook",
    "webhook-received",
    "webhook-on-receive",
    "on-receive-webhook",
    "on-message-received",
    "webhook-received-message",
    "get-webhook",
    "webhook-message",
    "callback",
    "callbacks",
    "on-message",
    "message-webhook",
    "groups",
    "chats",
  ];
  const results: Record<string, unknown>[] = [];
  for (const path of testes) {
    try {
      const r = await fetch(`${base}/${path}`, {
        headers: { "Client-Token": client },
      });
      const txt = await r.text();
      results.push({
        path,
        httpStatus: r.status,
        body: txt.slice(0, 400),
      });
    } catch (err) {
      results.push({ path, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ base: base.replace(inst, inst.slice(0, 6) + "…").replace(tok, tok.slice(0, 6) + "…"), results });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });

  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });

  const base = `https://api.z-api.io/instances/${inst}/token/${tok}`;
  const targetUrl = `${(process.env.NEXT_PUBLIC_BASE_URL || "https://cpsystem.app.br").replace(/\/$/, "")}/api/webhooks/zapi-inbound`;

  // Config atualiza FILTROS de tipos de msg (senao Z-API nao dispara nada).
  // Tenta multiplos formatos porque a doc é vaga sobre o path exato.
  const configs = [
    // Ativa filtros pra receber TODAS as msgs privadas + grupo
    {
      method: "PUT",
      path: "update-message-filters",
      body: {
        messageFilters: [
          "FILTER_FROM_PRIVATE_CHAT",
          "FILTER_FROM_GROUP",
          "FILTER_TEXT_MESSAGE",
          "FILTER_AUDIO_MESSAGE",
          "FILTER_IMAGE_MESSAGE",
          "FILTER_VIDEO_MESSAGE",
          "FILTER_DOCUMENT_MESSAGE",
        ],
        callbackTypeFilters: ["FILTER_RECEIVED_CALLBACK"],
      },
    },
    { method: "PUT", path: "filters", body: { messageFilters: ["FILTER_FROM_PRIVATE_CHAT", "FILTER_TEXT_MESSAGE"], callbackTypeFilters: ["FILTER_RECEIVED_CALLBACK"] } },
    // FILTROS ATIVOS — Z-API bloqueia webhook se filters vazio.
    // Aceita msgs de chats privados E grupos, todos tipos de conteudo,
    // callback tipo "recebido" (nao enviado).
    {
      method: "PUT",
      path: "update-filters",
      body: {
        messageFilters: [
          "FILTER_FROM_PRIVATE_CHAT",
          "FILTER_FROM_GROUP",
          "FILTER_TEXT_MESSAGE",
          "FILTER_AUDIO_MESSAGE",
          "FILTER_IMAGE_MESSAGE",
          "FILTER_VIDEO_MESSAGE",
          "FILTER_DOCUMENT_MESSAGE",
        ],
        callbackTypeFilters: ["FILTER_RECEIVED_CALLBACK"],
      },
    },
    { method: "PUT", path: "update-webhook-received", body: { value: targetUrl } },
  ];

  const results: Record<string, unknown>[] = [];
  for (const c of configs) {
    try {
      const r = await fetch(`${base}/${c.path}`, {
        method: c.method,
        headers: { "Client-Token": client, "Content-Type": "application/json" },
        body: JSON.stringify(c.body),
      });
      const txt = await r.text();
      results.push({ method: c.method, path: c.path, httpStatus: r.status, body: txt.slice(0, 400) });
    } catch (err) {
      results.push({ method: c.method, path: c.path, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ targetUrl, results });
}
