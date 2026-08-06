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

  // "me" é o endpoint que devolve a config real da instancia: todas as
  // *CallbackUrl (inclusive receivedCallbackUrl), receiveCallbackSentByMe,
  // connected, due e paymentStatus. É por onde se confere o que ESTÁ valendo —
  // os update-* respondem {"value":true} mesmo quando o efeito nao é o
  // esperado, entao nunca confie no retorno deles, confira aqui.
  const testes = ["me", "status", "device", "chats"];
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
  // Diagnostico de config — booleano apenas, nunca o valor do segredo.
  // Sem SUPORTE_GROUP_ID o alerta de chamado cai no fallback (admins com
  // optInWhatsApp=true); se nenhum admin tiver opt-in, o alerta some.
  const env = {
    SUPORTE_GROUP_ID: !!process.env.SUPORTE_GROUP_ID,
    WHATSAPP_KILL_SWITCH: process.env.WHATSAPP_KILL_SWITCH === "1",
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "(nao setado)",
  };
  return NextResponse.json({ base: base.replace(inst, inst.slice(0, 6) + "…").replace(tok, tok.slice(0, 6) + "…"), env, results });
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

  // ⚠️ NUNCA mandar tipo nenhum em messageFilters/callbackTypeFilters.
  //
  // Os filtros do Z-API sao BLOCKLIST: "os tipos incluidos no array NAO serao
  // entregues" (https://developer.z-api.io/webhooks/update-filters). A versao
  // anterior deste arquivo entendeu ao contrario — comentario dizia "Z-API
  // bloqueia webhook se filters vazio" — e mandava bloquear chat privado,
  // grupo, texto, audio, imagem, video, documento e FILTER_RECEIVED_CALLBACK.
  //
  // Resultado: de 14/07 a 06/08 o CP System nao recebeu UMA mensagem de
  // cliente. So chegavam callbacks de status/entrega, que nao estavam na
  // blocklist. O Leo mandou pergunta e ficou sem resposta por causa disso.
  //
  // Arrays vazios = nada bloqueado = tudo e entregue.
  const configs = [
    {
      method: "PUT",
      path: "update-filters",
      body: { messageFilters: [], callbackTypeFilters: [] },
    },
    { method: "PUT", path: "update-webhook-received", body: { value: targetUrl } },
    // Seta todos os webhooks da instancia de uma vez. notifySentByMe:false pra
    // nao ecoar o que nos mesmos enviamos (o webhook ja ignora fromMe).
    { method: "PUT", path: "update-every-webhooks", body: { value: targetUrl, notifySentByMe: false } },
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
