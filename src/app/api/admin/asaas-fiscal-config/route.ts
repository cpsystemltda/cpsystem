import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET)
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };
  const paths = [
    "/customerFiscalInfo",
    "/finance/config/nfse",
    "/nfse/config",
    "/myAccount/fiscal",
    "/myAccount/nfse",
    "/customer/fiscalInfo",
    "/company/nfse",
    "/finance/config",
  ];
  const results: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const r = await fetch(`${base}${p}`, { headers: h });
      const t = await r.text();
      results[p] = { status: r.status, body: t.slice(0, 800) };
    } catch (e) { results[p] = { erro: String(e) }; }
  }
  return NextResponse.json(results);
}
