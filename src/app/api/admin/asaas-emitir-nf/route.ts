import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const paymentId = url.searchParams.get("payment") || "pay_1lgo7hri6h855izd";
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey, "Content-Type": "application/json" };

  // Pega detalhes do payment pra montar payload
  const pay = await fetch(`${base}/payments/${paymentId}`, { headers: h }).then(r => r.json());

  // Pega servicos cadastrados pra pegar municipalServiceId
  const servicos = await fetch(`${base}/finance/config/services?onlyDefault=true`, { headers: h }).then(r => r.json()).catch(() => ({ data: [] }));
  const svcDefault = servicos?.data?.[0];

  const body: Record<string, unknown> = {
    payment: paymentId,
    serviceDescription: svcDefault?.description || "Licenciamento de uso da plataforma CP System (Lei 14.133/2021)",
    observations: "Emissao de teste via API",
    value: pay.value,
    deductions: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
  if (svcDefault?.id) body.municipalServiceId = svcDefault.id;

  const criar = await fetch(`${base}/invoices`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const criarBody = await criar.json();

  return NextResponse.json({
    paymentUsado: { id: pay.id, value: pay.value, customer: pay.customer, status: pay.status },
    servicoUsado: svcDefault,
    payloadEnviado: body,
    tentativaEmissao: { status: criar.status, response: criarBody },
  });
}
