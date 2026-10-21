import { NextRequest, NextResponse } from "next/server";
import { getGateway } from "@/lib/gateway";

/**
 * Ajusta a data da próxima cobrança de uma assinatura no Asaas.
 *
 * POST ?secret=&id=sub_x&data=AAAA-MM-DD
 *
 * Nasceu em 21/10/2026: a troca de cartão de um cliente com fatura vencida
 * apagou a fatura no Asaas, o cliente pagou "novembro" que na verdade era
 * outubro, e a assinatura nova ficou com a próxima cobrança em dezembro — o
 * mês de novembro ficaria sem cobrança. Esta rota devolve a assinatura ao
 * ciclo certo. Uso raro, sempre com a data conferida antes.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const id = url.searchParams.get("id") || "";
  const data = url.searchParams.get("data") || "";
  if (!/^sub_\w+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ erro: "informe id=sub_x e data=AAAA-MM-DD" }, { status: 400 });
  }
  const gw = await getGateway();
  if (!gw.atualizarProximoVencimento) return NextResponse.json({ erro: "gateway sem suporte" }, { status: 400 });
  const antes = gw.consultarAssinatura ? await gw.consultarAssinatura(id) : null;
  const r = await gw.atualizarProximoVencimento(id, new Date(`${data}T12:00:00Z`));
  const depois = gw.consultarAssinatura ? await gw.consultarAssinatura(id) : null;
  return NextResponse.json({ ok: true, id, antes, resultado: r, depois });
}
