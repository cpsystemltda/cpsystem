import { NextRequest, NextResponse } from "next/server";
import { asaasBaseUrl } from "@/lib/asaas-env";

// Reativa webhook Asaas que ficou "interrupted" apos falhas seguidas.
// Body do PUT deve incluir todos os campos originais (nao aceita PATCH).

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "sem apikey" }, { status: 500 });
  const base = asaasBaseUrl();

  // 1) Lista webhooks pra achar o id + config atual
  const listRes = await fetch(`${base}/webhooks`, { headers: { access_token: apiKey } });
  const list = await listRes.json();
  if (!list.data || list.data.length === 0) return NextResponse.json({ erro: "nenhum webhook cadastrado" });

  const results: Record<string, unknown>[] = [];
  for (const wh of list.data) {
    // Reenvia mesma config com interrupted: false pra retomar
    const body = {
      name: wh.name,
      url: wh.url,
      email: wh.email,
      enabled: true,
      interrupted: false, // reativa
      apiVersion: wh.apiVersion || 3,
      sendType: wh.sendType || "SEQUENTIALLY",
      events: wh.events,
      // se tinha auth token, mantem — mas API nao retorna, ent so passa null
      authToken: process.env.ASAAS_WEBHOOK_TOKEN || undefined,
    };
    const r = await fetch(`${base}/webhooks/${wh.id}`, {
      method: "PUT",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const resp = await r.json();
    results.push({ id: wh.id, httpStatus: r.status, response: resp });
  }
  return NextResponse.json({ results });
}
