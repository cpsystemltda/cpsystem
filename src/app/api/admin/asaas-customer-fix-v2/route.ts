import { NextRequest, NextResponse } from "next/server";

// Regina 17/07: corrige endereço do customer teste. O address que eu tinha
// setado ("SRTVS Qd. 701...") nao bate com o CEP 70340-906 (esse CEP eh do
// SRTVS Conjunto L Lote 38). Prefeitura BSB rejeita NFSe quando endereco
// nao bate com CEP no ViaCEP. Usa o endereço REAL da CP System.

const BASE = "https://api.asaas.com/v3";

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY faltando" }, { status: 500 });

  const updates = [
    // TOMADOR TESTE — Contato CP System (cus_000183125870)
    // Usa endereco REAL da CP System (mesmo do emitente) que sabemos que bate
    // com o CEP no cadastro fiscal.
    {
      id: "cus_000183125870",
      patch: {
        address: "SRTVS Conjunto L Lote 38 Centro Empresarial Assis Chateaubriand",
        addressNumber: "616",
        complement: "Sala 616",
        province: "Asa Sul",
        postalCode: "70340-906",
      },
    },
    // TOMADOR LEO (cus_000187257830) — atualiza tambem pro caso dia 20
    // O endereco atual "SMAS Trecho 3, Lote 1, Sala 223B" precisa ser validado
    // contra o CEP 70610-051. Deixa esse por enquanto e conferimos separado.
  ];

  const results = [];
  for (const u of updates) {
    const r = await fetch(`${BASE}/customers/${u.id}`, {
      method: "POST",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(u.patch),
    });
    const body = await r.json();
    results.push({ customerId: u.id, httpStatus: r.status, resposta: body });
  }
  return NextResponse.json({ results });
}
