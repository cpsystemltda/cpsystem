import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const paymentId = url.searchParams.get("payment") || "pay_1lgo7hri6h855izd";
  // Permite override do codigo pra testar variantes (ex: "1.05", "0105", "105")
  const codeOverride = url.searchParams.get("code");
  const apiKey = process.env.ASAAS_API_KEY!;
  const base = "https://api.asaas.com/v3";
  const h = { access_token: apiKey, "Content-Type": "application/json" };

  const pay = await fetch(`${base}/payments/${paymentId}`, { headers: h }).then(r => r.json());

  // municipalServiceCode = item da LC 116 no formato "X.YY" (docs Asaas).
  // Prefeitura DF exige 3-4 digitos. Item 1.05 = "Licenciamento ou cessao de
  // direito de uso de programas de computacao" (LC 116/2003).
  const municipalServiceCode = codeOverride || "1.05";

  const body: Record<string, unknown> = {
    payment: paymentId,
    serviceDescription: "Licenciamento de uso da plataforma CP System (Lei 14.133/2021)",
    observations: "Emissao via API",
    value: pay.value,
    deductions: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
    municipalServiceCode,
    municipalServiceName: "Licenciamento ou cessao de direito de uso de programas de computacao",
    taxes: {
      retainIss: false,
      iss: 5,
      cofins: 0,
      csll: 0,
      inss: 0,
      ir: 0,
      pis: 0,
    },
  };

  const criar = await fetch(`${base}/invoices`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const criarBody = await criar.json();

  return NextResponse.json({
    paymentUsado: { id: pay.id, value: pay.value, customer: pay.customer, status: pay.status },
    payloadEnviado: body,
    tentativaEmissao: { status: criar.status, response: criarBody },
  });
}
