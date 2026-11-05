import { NextResponse } from "next/server";
import { pagarComissoesDoMesAnterior } from "@/lib/pagamentoAnalista";

// Cron dia 20 (Regina 13/07), hoje só rede de segurança: desde 24/08 a régua
// diária (`regua.ts`) repassa a comissão assim que o dinheiro do cliente entra
// em conta — PIX no mesmo dia, cartão quando a operadora libera (~32 dias).
// O dia 20 NÃO é mais a data de pagamento e não deve aparecer em texto nenhum
// para analista ou indicador (Regina 05/11). Paga R$ 29,90 por vínculo via
// PIX out no Asaas.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await pagarComissoesDoMesAnterior().catch((e) => ({
    competenciaPaga: "",
    tentativas: 0,
    sucessos: 0,
    falhas: 0,
    totalPagoBRL: 0,
    erro: e instanceof Error ? e.message : String(e),
  }));
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
