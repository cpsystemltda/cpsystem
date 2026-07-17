import { NextRequest, NextResponse } from "next/server";

// Regina 17/07: endereços dos customers usando dado EXATO do ViaCEP oficial.
// Prefeitura DF rejeita quando address nao bate com o logradouro que o
// ViaCEP retorna pro CEP.
//
// Correcao anterior misturava "logradouro + unidade" em address. Correto:
// address = so logradouro; complement = sala/andar; unidade fica em observations
// ou complement estendido.

const BASE = "https://api.asaas.com/v3";

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY!;

  const updates = [
    // TOMADOR TESTE (cus_000183125870) — CEP 70340-906
    {
      id: "cus_000183125870",
      patch: {
        address: "SRTVS Conjunto L Lote 38",
        addressNumber: "616",
        complement: "Centro Empresarial Assis Chateaubriand, Sala 616",
        province: "Asa Sul",
        postalCode: "70340906",
      },
    },
    // LEO (cus_000187257830) — CEP 70610-051
    {
      id: "cus_000187257830",
      patch: {
        address: "Setor SMAS Trecho 3 Lote 1",
        addressNumber: "S/N",
        complement: "Sala 223B",
        province: "Setores Complementares",
        postalCode: "70610051",
      },
    },
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
