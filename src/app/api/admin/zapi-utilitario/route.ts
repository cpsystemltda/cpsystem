import { NextRequest, NextResponse } from "next/server";

// Utilitario admin pra Z-API: checar status, listar chats (grupos e contatos),
// e enviar texto pra um phone/groupId ARBITRARIO (sem passar pela camada de
// idempotencia/opt-in — uso pontual da Regina).

function base() {
  const id = process.env.ZAPI_INSTANCE_ID!;
  const tk = process.env.ZAPI_INSTANCE_TOKEN!;
  return `https://api.z-api.io/instances/${id}/token/${tk}`;
}
function headers() {
  return { "Client-Token": process.env.ZAPI_CLIENT_TOKEN!, "Content-Type": "application/json" };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const acao = url.searchParams.get("acao") || "status";

  if (acao === "status") {
    const r = await fetch(`${base()}/status`, { headers: headers() });
    return NextResponse.json({ status: r.status, body: await r.json() });
  }

  if (acao === "chats") {
    // Z-API: GET /chats retorna chats recentes (contatos + grupos)
    const r = await fetch(`${base()}/chats?page=1&pageSize=200`, { headers: headers() });
    const body = await r.json();
    // Filtra e destaca grupos
    const chats = Array.isArray(body) ? body : (body?.data ?? []);
    const grupos = chats.filter((c: { isGroup?: boolean }) => c.isGroup);
    return NextResponse.json({ total: chats.length, gruposCount: grupos.length, grupos });
  }

  return NextResponse.json({ erro: "acao invalida" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { phone: string; message: string };
  if (!body.phone || !body.message) {
    return NextResponse.json({ erro: "phone e message obrigatorios" }, { status: 400 });
  }
  // Checa status antes (regra memoria)
  const st = await fetch(`${base()}/status`, { headers: headers() }).then((r) => r.json());
  if (!st.connected) {
    return NextResponse.json({ erro: "Z-API desconectada", status: st }, { status: 503 });
  }
  const r = await fetch(`${base()}/send-text`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ phone: body.phone, message: body.message }),
  });
  return NextResponse.json({ statusHttp: r.status, resposta: await r.json() });
}
