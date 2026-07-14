import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const inst = process.env.ZAPI_INSTANCE_ID;
  const tok = process.env.ZAPI_INSTANCE_TOKEN;
  const client = process.env.ZAPI_CLIENT_TOKEN;
  if (!inst || !tok || !client) return NextResponse.json({ erro: "ZAPI env faltando" }, { status: 500 });
  const base = `https://api.z-api.io/instances/${inst}/token/${tok}`;

  // Metadados da instancia — se webhook estava setado, aparece aqui
  const paths = [
    "device",
    "me",
    "info",
    "instance-info",
    "version",
    "settings",
    "config",
    "plan",
  ];
  const results: Record<string, unknown>[] = [];
  for (const p of paths) {
    try {
      const r = await fetch(`${base}/${p}`, { headers: { "Client-Token": client } });
      const txt = await r.text();
      results.push({ path: p, httpStatus: r.status, body: txt.slice(0, 500) });
    } catch (err) {
      results.push({ path: p, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return NextResponse.json({ results });
}
