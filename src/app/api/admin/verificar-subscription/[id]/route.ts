import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/verificar-subscription/[id]?secret=<CRON_SECRET>
// Consulta o Asaas via API pra confirmar que a subscription foi criada com
// billingType=CREDIT_CARD e o cartao foi tokenizado. Retorna status + dados
// mascarados. Protegido por CRON_SECRET (super admin remoto).
//
// Regina 14/07: check pos-migracao do Leo.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const apiKey = process.env.ASAAS_API_KEY;
  const ambiente = process.env.ASAAS_AMBIENTE || "sandbox";
  if (!apiKey) return NextResponse.json({ erro: "ASAAS_API_KEY nao configurado" }, { status: 500 });

  const base = ambiente === "producao" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  const baseSandbox = "https://sandbox.asaas.com/api/v3";
  const baseProd = "https://api.asaas.com/v3";

  try {
    // Tenta em ambos os ambientes pra debugar migracoes de sandbox->prod
    const [subProd, subSandbox, paymentsResp] = await Promise.all([
      fetch(`${baseProd}/subscriptions/${id}`, {
        headers: { access_token: apiKey, "Content-Type": "application/json" },
      }),
      fetch(`${baseSandbox}/subscriptions/${id}`, {
        headers: { access_token: apiKey, "Content-Type": "application/json" },
      }),
      fetch(`${base}/subscriptions/${id}/payments`, {
        headers: { access_token: apiKey, "Content-Type": "application/json" },
      }),
    ]);
    const subProdJson = await subProd.json();
    const subSandboxJson = await subSandbox.json();
    // Prefere prod se achou, senao sandbox
    const sub = subProdJson.id ? { json: async () => subProdJson } : { json: async () => subSandboxJson };
    const foundIn = subProdJson.id ? "producao" : subSandboxJson.id ? "sandbox" : "nenhum";

    const subJson = await sub.json();
    const paymentsJson = await paymentsResp.json();

    // Filtra dados sensíveis — mostra só o essencial pra Regina confirmar
    const resumo: Record<string, unknown> = {
      ambienteEnv: ambiente,
      subscriptionEncontradaEm: foundIn,
      apiKeyPrefix: apiKey.slice(0, 15),
      subscriptionId: subJson.id,
      customer: subJson.customer,
      status: subJson.status,
      billingType: subJson.billingType,
      cycle: subJson.cycle,
      value: subJson.value,
      nextDueDate: subJson.nextDueDate,
      // Cartao tokenizado (mascarado)
      creditCardBrand: subJson.creditCard?.creditCardBrand,
      creditCardNumber: subJson.creditCard?.creditCardNumber,
      creditCardHolderInfo: subJson.creditCardHolderInfo
        ? {
            name: subJson.creditCardHolderInfo.name,
            cpfCnpj: subJson.creditCardHolderInfo.cpfCnpj,
          }
        : undefined,
      // Faturas geradas
      totalPayments: paymentsJson.totalCount,
      payments: (paymentsJson.data ?? []).slice(0, 5).map((p: { id: string; status: string; dueDate: string; value: number; billingType: string; invoiceUrl: string }) => ({
        id: p.id,
        status: p.status,
        dueDate: p.dueDate,
        value: p.value,
        billingType: p.billingType,
        invoiceUrl: p.invoiceUrl,
      })),
      // Erros caso a subscription nao exista
      erroSub: subJson.errors,
    };

    return NextResponse.json(resumo, { status: 200 });
  } catch (err) {
    return NextResponse.json({ erro: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
