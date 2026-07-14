import { NextRequest, NextResponse } from "next/server";

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
  const baseProd = "https://api.asaas.com/v3";
  const baseSandbox = "https://sandbox.asaas.com/api/v3";

  const [prodResp, sandboxResp] = await Promise.all([
    fetch(`${baseProd}/payments/${id}`, { headers: { access_token: apiKey } }),
    fetch(`${baseSandbox}/payments/${id}`, { headers: { access_token: apiKey } }),
  ]);
  const prodJson = await prodResp.json();
  const sandboxJson = await sandboxResp.json();

  return NextResponse.json({
    ambienteEnv: ambiente,
    apiKeyPrefix: apiKey.slice(0, 15),
    prod: prodJson,
    sandbox: sandboxJson,
  });
}
