import { NextRequest, NextResponse } from "next/server";

// Corrige endereco estruturado de customers Asaas — dia 20/07 precisa que o
// Leo tenha endereco completo pra NF sair. Também corrige o customer de
// teste da Regina.

const BASE = "https://api.asaas.com/v3";

type CustomerUpdate = {
  id: string;
  patch: Record<string, string | null>;
};

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY faltando" }, { status: 500 });

  const updates: CustomerUpdate[] = [
    // LEO — C.L.A DOS SANTOS ESTUDIO
    {
      id: "cus_000187257830",
      patch: {
        address: "SMAS Trecho 3, Lote 1, Sala 223B",
        addressNumber: "223B",
        complement: "Setores Complementares",
        province: "Setores Complementares",
        city: "Brasília",
        state: "DF",
        postalCode: "70610-051",
      },
    },
    // REGINA — Contato CP System (customer de teste)
    // CNPJ 42.736.317/0001-30 (pessoal da Regina — usado no teste-asaas)
    // Preenchendo endereco valido pra destravar emissao de teste.
    {
      id: "cus_000183125870",
      patch: {
        address: "SRTVS Qd. 701, Bloco B, Sala 616",
        addressNumber: "701",
        complement: "Sala 616",
        province: "Asa Sul",
        city: "Brasília",
        state: "DF",
        postalCode: "70340-906",
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
