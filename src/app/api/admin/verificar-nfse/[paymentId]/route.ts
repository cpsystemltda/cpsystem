import { NextRequest, NextResponse } from "next/server";

// Consulta se NFSe foi emitida pra um paymentId no Asaas.
// GET /v3/invoices?payment={paymentId}

export async function GET(req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const { paymentId } = await params;
  const apiKey = process.env.ASAAS_API_KEY;
  const ambiente = process.env.ASAAS_AMBIENTE || "sandbox";
  const base = ambiente === "producao" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  if (!apiKey) return NextResponse.json({ erro: "sem apikey" }, { status: 500 });

  const [invoices, payment] = await Promise.all([
    fetch(`${base}/invoices?payment=${paymentId}`, { headers: { access_token: apiKey } }).then((r) => r.json()),
    fetch(`${base}/payments/${paymentId}`, { headers: { access_token: apiKey } }).then((r) => r.json()),
  ]);
  return NextResponse.json({ paymentStatus: payment.status, invoices });
}
