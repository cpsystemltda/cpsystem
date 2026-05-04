import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { processarEventoGateway } from "@/app/actions/assinatura";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const rawBody = await req.text();

  const gateway = await getGateway();
  if (gateway.nome.toLowerCase() !== provider.toLowerCase()) {
    return NextResponse.json({ erro: "Provider não corresponde ao configurado." }, { status: 400 });
  }

  const valido = await gateway.validarWebhook(req.headers, rawBody);
  if (!valido) {
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }

  const evento = await gateway.parsearWebhook(rawBody);
  if (!evento || !evento.chargeId) {
    return NextResponse.json({ erro: "Evento inválido." }, { status: 400 });
  }

  // Persiste evento bruto pra auditoria
  const cobranca = await prisma.cobranca.findFirst({ where: { gatewayChargeId: evento.chargeId } });
  await prisma.eventoGateway.create({
    data: {
      cobrancaId: cobranca?.id || null,
      provider: gateway.nome,
      evento: evento.evento,
      payload: rawBody.slice(0, 4000), // trunca pra evitar payload gigante
    },
  });

  if (evento.status) {
    await processarEventoGateway({
      chargeId: evento.chargeId,
      status: evento.status,
      pagaEm: evento.pagaEm,
    });
  }

  return NextResponse.json({ ok: true });
}

// GET pra teste manual em dev
export async function GET() {
  return NextResponse.json({ msg: "Webhook receiver ok. Use POST." });
}
