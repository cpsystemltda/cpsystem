import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };

  // Tenta varios paths pra listar servicos municipais suportados pra DF (15872)
  const paths = [
    "/finance/config/services",
    "/finance/config/services?cityId=15872",
    "/finance/config/services?municipalCode=5300108",
    "/finance/config/services/15872",
    "/cities/15872/services",
    "/nfse/services/15872",
    "/nfse/services?city=15872",
    "/invoices/services?city=15872",
    "/nfse/config/services",
    "/nfse/config/services/15872",
    "/finance/nfse/services/15872",
    "/finance/nfse/config/services",
  ];
  const results: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const r = await fetch(`${base}${p}`, { headers: h });
      const t = await r.text();
      results[p] = { status: r.status, body: t.slice(0, 400) };
    } catch (e) {
      results[p] = { erro: String(e) };
    }
  }
  return NextResponse.json(results);
}
