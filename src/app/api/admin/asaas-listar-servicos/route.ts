import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const paths = [
    "/finance/config/services",
    "/finance/services",
    "/services",
    "/invoices/config/services",
    "/finance/config/service",
    "/finance/config/serviceItems",
    "/finance/config/nfseServices",
  ];
  const r: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const resp = await fetch(`${base}${p}`, { headers: { access_token: apiKey } });
      const txt = await resp.text();
      r[p] = { status: resp.status, body: txt.slice(0, 500) };
    } catch (e) { r[p] = { erro: String(e) }; }
  }
  return NextResponse.json(r);
}
