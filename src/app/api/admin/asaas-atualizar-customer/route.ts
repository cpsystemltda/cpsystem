import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT https://api.asaas.com/v3/customers/{customerId} — atualiza dados do customer.
// Regina 14/07: NF ia pro email errado do Leo.

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { contaId?: string; email?: string; nome?: string } | null;
  if (!body?.contaId) return NextResponse.json({ erro: "contaId obrigatorio" }, { status: 400 });

  const conta = await prisma.conta.findUnique({
    where: { id: body.contaId },
    select: { gatewayCustomerId: true, usuarios: { select: { email: true, nome: true }, take: 1 } },
  });
  if (!conta?.gatewayCustomerId) return NextResponse.json({ erro: "sem customer Asaas" });

  const apiKey = process.env.ASAAS_API_KEY;
  const ambiente = process.env.ASAAS_AMBIENTE || "sandbox";
  const base = ambiente === "producao" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  const emailFinal = body.email ?? conta.usuarios[0]?.email;
  const nomeFinal = body.nome ?? conta.usuarios[0]?.nome;

  const r = await fetch(`${base}/customers/${conta.gatewayCustomerId}`, {
    method: "PUT",
    headers: { access_token: apiKey!, "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailFinal, name: nomeFinal }),
  });
  const respJson = await r.json();
  return NextResponse.json({ httpStatus: r.status, customer: respJson });
}
