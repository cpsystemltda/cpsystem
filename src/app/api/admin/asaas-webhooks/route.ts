import { NextRequest, NextResponse } from "next/server";
import { asaasBaseUrl, asaasProducao } from "@/lib/asaas-env";

// Lista webhooks configurados no Asaas + status
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  const apiKey = process.env.ASAAS_API_KEY;
  const base = asaasBaseUrl();
  if (!apiKey) return NextResponse.json({ erro: "sem apikey" }, { status: 500 });

  const [webhooks, myAccount] = await Promise.all([
    fetch(`${base}/webhooks`, { headers: { access_token: apiKey } }).then((r) => r.json()),
    fetch(`${base}/myAccount`, { headers: { access_token: apiKey } }).then((r) => r.json()),
  ]);
  return NextResponse.json({
    apiKeyPrefix: apiKey.slice(0, 15),
    ambienteEnv: process.env.ASAAS_AMBIENTE,
    ambienteResolvido: asaasProducao() ? "producao" : "sandbox",
    baseUrl: base,
    webhooks,
    myAccount: {
      id: myAccount.id,
      email: myAccount.email,
      name: myAccount.name,
      cpfCnpj: myAccount.cpfCnpj,
      companyType: myAccount.companyType,
    },
  });
}
