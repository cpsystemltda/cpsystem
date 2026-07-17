import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const invId = url.searchParams.get("inv") || "inv_000021212801";
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey, "Content-Type": "application/json" };

  // Tenta várias formas de cancelar NF
  const paths = [
    { method: "POST", path: `/invoices/${invId}/cancel` },
    { method: "DELETE", path: `/invoices/${invId}` },
    { method: "POST", path: `/invoices/${invId}/cancellation` },
  ];
  const results: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const r = await fetch(`${base}${p.path}`, { method: p.method, headers: h, body: p.method === "POST" ? JSON.stringify({}) : undefined });
      const txt = await r.text();
      results[`${p.method} ${p.path}`] = { status: r.status, body: txt.slice(0, 400) };
    } catch (e) {
      results[`${p.method} ${p.path}`] = { erro: String(e) };
    }
  }
  return NextResponse.json(results);
}
