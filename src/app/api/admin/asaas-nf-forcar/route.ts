import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const invId = url.searchParams.get("inv") || "inv_000021212801";
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey, "Content-Type": "application/json" };

  const tentativas = [
    { method: "POST", path: `/invoices/${invId}/authorize` },
    { method: "POST", path: `/invoices/${invId}/retry` },
    { method: "POST", path: `/invoices/${invId}/resend` },
    { method: "POST", path: `/invoices/${invId}/sync` },
    { method: "POST", path: `/invoices/${invId}/schedule` },
    { method: "PUT", path: `/invoices/${invId}` },
    { method: "GET", path: `/invoices/${invId}/pdf` },
  ];
  const r: Record<string, unknown> = {};
  for (const t of tentativas) {
    try {
      const resp = await fetch(`${base}${t.path}`, { method: t.method, headers: h, body: t.method === "POST" ? JSON.stringify({}) : undefined });
      const txt = await resp.text();
      r[`${t.method} ${t.path}`] = { status: resp.status, body: txt.slice(0, 300) };
    } catch (e) { r[`${t.method} ${t.path}`] = { erro: String(e) }; }
  }
  return NextResponse.json(r);
}
