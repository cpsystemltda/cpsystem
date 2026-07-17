import { NextRequest, NextResponse } from "next/server";

// Reativa webhook Asaas que ficou "INTERROMPIDO" apos falhas consecutivas.
// Regina 17/07: nosso webhook parou de receber INVOICE_AUTHORIZED do Asaas.
//
// GET  = lista webhooks + status atual
// POST = reativa: URL correta + events completos + enabled=true + interrupted=false

const ENDPOINT_ALVO = "https://cpsystem.app.br/api/webhooks/asaas";

// Eventos que a gente precisa (pagamento + NFSe)
const EVENTS_NECESSARIOS = [
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "INVOICE_CREATED",
  "INVOICE_UPDATED",
  "INVOICE_SYNCHRONIZED",
  "INVOICE_AUTHORIZED",
  "INVOICE_PROCESSING_CANCELLATION",
  "INVOICE_CANCELED",
  "INVOICE_CANCELLATION_DENIED",
  "INVOICE_ERROR",
];

function ambienteBase(): string {
  return (process.env.ASAAS_AMBIENTE || "sandbox") === "producao"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY faltando" }, { status: 500 });

  const r = await fetch(`${ambienteBase()}/webhooks`, {
    headers: { access_token: apiKey },
  });
  const data = await r.json();
  return NextResponse.json({ ambiente: process.env.ASAAS_AMBIENTE, webhooks: data });
}

export async function POST(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY faltando" }, { status: 500 });
  const base = ambienteBase();

  // 1) Lista webhooks pra achar o "CP System Cobranças" (ou qualquer que aponte pro nosso endpoint)
  const listResp = await fetch(`${base}/webhooks`, { headers: { access_token: apiKey } });
  const list = (await listResp.json()) as { data?: Array<{ id: string; name?: string; url: string }> };
  const alvo = list.data?.find((w) => w.url === ENDPOINT_ALVO || w.name?.toLowerCase().includes("cp system"));

  const body = {
    name: "CP System Cobranças",
    url: ENDPOINT_ALVO,
    email: "contato@cpsystem.app.br",
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    sendType: "SEQUENTIALLY",
    authToken: process.env.ASAAS_WEBHOOK_TOKEN || undefined,
    events: EVENTS_NECESSARIOS,
  };

  let resultado;
  if (alvo?.id) {
    // Atualiza existente — desmarca interrupted, garante eventos
    const upd = await fetch(`${base}/webhooks/${alvo.id}`, {
      method: "PUT",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    resultado = { acao: "atualizado", webhookId: alvo.id, status: upd.status, body: await upd.json() };
  } else {
    // Cria novo
    const create = await fetch(`${base}/webhooks`, {
      method: "POST",
      headers: { access_token: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    resultado = { acao: "criado", status: create.status, body: await create.json() };
  }

  return NextResponse.json({ ambiente: process.env.ASAAS_AMBIENTE, targetUrl: ENDPOINT_ALVO, resultado });
}
