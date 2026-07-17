import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };

  // 1) NF atualizada
  const nf = await fetch(`${base}/invoices/inv_000021212801`, { headers: h }).then(r => r.json());

  // 2) Info fiscal do EMITENTE (config da CP System)
  const paths = [
    "/finance/config/nfseCompany",
    "/finance/nfseConfig",
    "/nfse/config",
    "/nfse/settings",
    "/invoices/settings",
    "/invoices/config",
    "/myAccount",
  ];
  const emitente: Record<string, unknown> = {};
  for (const p of paths) {
    try {
      const r = await fetch(`${base}${p}`, { headers: h });
      const txt = await r.text();
      emitente[p] = { status: r.status, body: txt.slice(0, 600) };
    } catch (e) { emitente[p] = { erro: String(e) }; }
  }

  // 3) Customer tomador
  const tomador = await fetch(`${base}/customers/cus_000183125870`, { headers: h }).then(r => r.json());

  return NextResponse.json({ nf, emitente, tomador });
}
