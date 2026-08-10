import { NextRequest, NextResponse } from "next/server";
import {
  conversoesPendentes,
  marcarEnviadas,
  montarCsv,
} from "@/lib/conversoesGoogleAds";

/**
 * Exporta as assinaturas pagas que vieram de anuncio, no formato de upload de
 * conversoes offline do Google Ads (Metas > Uploads > Fazer upload).
 *
 * GET  ?secret=...            -> previa em JSON, nao marca nada
 * GET  ?secret=...&csv=1      -> baixa o CSV e marca as contas como enviadas
 *
 * Marcar so no download evita contar a mesma venda duas vezes; conferir antes
 * pelo JSON evita marcar sem querer enquanto se olha o que tem na fila.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  const linhas = await conversoesPendentes();

  if (url.searchParams.get("csv") !== "1") {
    return NextResponse.json({
      pendentes: linhas.length,
      valorTotal: linhas.reduce((s, l) => s + l.valor, 0),
      linhas: linhas.map((l) => ({
        contaId: l.contaId,
        gclid: `${l.gclid.slice(0, 12)}…`,
        pagaEm: l.quando.toISOString(),
        valor: l.valor,
      })),
      comoUsar:
        "Adicione &csv=1 para baixar o arquivo. Depois: Google Ads > Metas > Uploads > Fazer upload.",
    });
  }

  const csv = montarCsv(linhas);
  await marcarEnviadas(linhas.map((l) => l.contaId));

  const hoje = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="conversoes-google-ads-${hoje}.csv"`,
    },
  });
}
