import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const payment = url.searchParams.get("payment");
  if (!payment) return NextResponse.json({ erro: "payment ausente" }, { status: 400 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const r = await fetch(`https://api.asaas.com/v3/invoices?payment=${payment}&limit=100`, {
    headers: { access_token: apiKey },
  });
  const body = await r.json();
  return NextResponse.json(body);
}
