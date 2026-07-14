import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });
  const r = await fetch(`https://api.z-api.io/instances/${inst}/token/${tok}/status`, {
    headers: { "Client-Token": client },
  });
  const status = await r.json();
  return NextResponse.json({ httpStatus: r.status, status });
}
