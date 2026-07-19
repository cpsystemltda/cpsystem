import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey };

  // Lista pagamentos RECEIVED/CONFIRMED
  const pays = await fetch(`${base}/payments?status=RECEIVED&limit=20`, { headers: h }).then(r => r.json());
  const paysConf = await fetch(`${base}/payments?status=CONFIRMED&limit=20`, { headers: h }).then(r => r.json());

  const todos = [...(pays.data ?? []), ...(paysConf.data ?? [])];

  // Pra cada, verifica se tem invoice associada
  const result = [];
  for (const p of todos) {
    const invs = await fetch(`${base}/invoices?payment=${p.id}`, { headers: h }).then(r => r.json());
    result.push({
      id: p.id,
      value: p.value,
      dateCreated: p.dateCreated,
      confirmedDate: p.confirmedDate,
      customer: p.customer,
      description: p.description,
      billingType: p.billingType,
      invoices: (invs.data ?? []).map((i: { id: string; status: string; number: string | null }) => ({ id: i.id, status: i.status, number: i.number })),
    });
  }
  return NextResponse.json({ total: result.length, pagamentos: result });
}
