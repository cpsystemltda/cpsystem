import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const id = url.searchParams.get("id") || "inv_000021212801";
  const apiKey = process.env.ASAAS_API_KEY;
  const base = "https://api.asaas.com/v3";
  const [inv, evs] = await Promise.all([
    fetch(`${base}/invoices/${id}`, { headers: { access_token: apiKey! } }).then((r) => r.json()),
    fetch(`${base}/invoices/${id}/events`, { headers: { access_token: apiKey! } }).then((r) => r.json()).catch((e) => ({ erro: String(e) })),
  ]);
  return NextResponse.json({ invoice: inv, events: evs });
}
