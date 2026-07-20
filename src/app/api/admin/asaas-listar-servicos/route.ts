import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };

  const [servicos, myAcc] = await Promise.all([
    fetch(`${base}/finance/config/services?limit=100`, { headers: h }).then(r => r.json()).catch(e => ({erro:String(e)})),
    fetch(`${base}/myAccount`, { headers: h }).then(r => r.json()).catch(e => ({erro:String(e)})),
  ]);

  return NextResponse.json({ servicos, myAcc });
}
