import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const invoiceId = url.searchParams.get("id");
  if (!invoiceId) return NextResponse.json({ erro: "id ausente" }, { status: 400 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };

  const del = await fetch(`${base}/invoices/${invoiceId}/cancel`, {
    method: "POST",
    headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await del.json().catch(() => ({}));
  return NextResponse.json({ status: del.status, response: body });
}
