import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "sem key" }, { status: 500 });
  const paymentId = url.searchParams.get("payment") || "pay_ao3rx1tqoqqsy3o8";
  const base = "https://api.asaas.com/v3";
  const r = await fetch(`${base}/invoices?payment=${paymentId}`, { headers: { access_token: apiKey } });
  const list = await r.json();
  return NextResponse.json(list);
}
