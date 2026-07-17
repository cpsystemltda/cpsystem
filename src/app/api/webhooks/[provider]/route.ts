import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { processarEventoGateway, processarNfseGateway } from "@/app/actions/assinatura";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const rawBody = await req.text();

  const gateway = await getGateway();
  if (gateway.nome.toLowerCase() !== provider.toLowerCase()) {
    // Regina 17/07: retorna 200 pra Asaas nao penalizar o webhook. Log local
    // fica pra auditoria; do lado do gateway, ack = evento processado.
    console.warn(`[webhook/${provider}] provider ${provider} nao corresponde a ${gateway.nome} — ignorando`);
    return NextResponse.json({ ok: true, ignored: "provider_mismatch" });
  }

  const valido = await gateway.validarWebhook(req.headers, rawBody);
  if (!valido) {
    // Auth invalido — mantem 401 (esse eh o unico caso onde 4xx faz sentido)
    return NextResponse.json({ erro: "Token inválido." }, { status: 401 });
  }

  let evento: Awaited<ReturnType<typeof gateway.parsearWebhook>> = null;
  try {
    evento = await gateway.parsearWebhook(rawBody);
  } catch (err) {
    console.error(`[webhook/${provider}] erro ao parsear payload:`, err);
    return NextResponse.json({ ok: true, ignored: "parse_error" });
  }

  // Regina 17/07: eventos que a gente NAO processa (ex: SUBSCRIPTION_CREATED,
  // ACCOUNT_STATUS_UPDATED, TRANSFER_*, etc) precisam retornar 200. Asaas
  // penaliza o webhook se retornar 4xx/5xx nesses casos e para de disparar.
  if (!evento) {
    // Persiste raw pra auditoria — depois investigamos se eh algum tipo novo
    try {
      await prisma.eventoGateway.create({
        data: {
          cobrancaId: null,
          provider: gateway.nome,
          evento: "UNKNOWN_OR_UNHANDLED",
          payload: rawBody.slice(0, 4000),
        },
      });
    } catch {}
    return NextResponse.json({ ok: true, ignored: "evento_nao_processado" });
  }

  // Se chegou aqui, temos um evento parseavel MAS pode nao ter chargeId
  // (ex: eventos de conta ou subscription sem cobranca vinculada)
  if (!evento.chargeId) {
    try {
      await prisma.eventoGateway.create({
        data: {
          cobrancaId: null,
          provider: gateway.nome,
          evento: evento.evento,
          payload: rawBody.slice(0, 4000),
        },
      });
    } catch {}
    return NextResponse.json({ ok: true, ignored: "sem_chargeId" });
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
    try {
      await processarEventoGateway({
        chargeId: evento.chargeId,
        status: evento.status,
        pagaEm: evento.pagaEm,
      });
    } catch (err) {
      // Nao propaga: retorna 200 pra Asaas nao penalizar; loga pra debug.
      console.error(`[webhook/${provider}] erro processando ${evento.evento}:`, err);
    }
  }

  // Evento de NF (INVOICE_CREATED / INVOICE_SYNCHRONIZED / INVOICE_AUTHORIZED)
  if (evento.nfse && evento.nfse.paymentIdRelacionado) {
    try {
      await processarNfseGateway({
        paymentId: evento.nfse.paymentIdRelacionado,
        nfseId: evento.nfse.nfseId,
        numero: evento.nfse.numero,
        status: evento.nfse.status,
        pdfUrl: evento.nfse.pdfUrl,
        xmlUrl: evento.nfse.xmlUrl,
        emitidaEm: evento.nfse.emitidaEm,
      });
    } catch (err) {
      console.error(`[webhook/${provider}] erro processando NFSe:`, err);
    }
  }

  return NextResponse.json({ ok: true });
}

// GET pra teste manual em dev
export async function GET() {
  return NextResponse.json({ msg: "Webhook receiver ok. Use POST." });
}
