import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const invId = url.searchParams.get("inv") || "inv_000021212801";
  const custId = url.searchParams.get("cust") || "cus_000183125870";
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };

  const paths = [
    `/invoices/${invId}`,
    `/invoices/${invId}/history`,
    `/invoices/${invId}/events`,
    `/invoices/${invId}/errors`,
    `/invoices/${invId}/messages`,
    `/customers/${custId}`,
    `/finance/config/nfsePendencies`,
  ];
  const results: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const r = await fetch(`${base}${p}`, { headers: h });
      const txt = await r.text();
      results[p] = { status: r.status, body: txt.slice(0, 800) };
    } catch (e) {
      results[p] = { erro: String(e) };
    }
  }
  return NextResponse.json(results);
}
