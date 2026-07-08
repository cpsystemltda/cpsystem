import { NextResponse } from "next/server";
import { executarResumoDaJanela } from "@/lib/notificacoesResumo";

// Cron TARDE (Regina 08/07) — 14h BRT (17h UTC). Envia msg consolidada com
// prazos D-5/D-10/D-15, NF sem pagamento 30d+ e fatura CP System vencendo em 3d.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await executarResumoDaJanela("TARDE").catch((e) => ({
    janela: "TARDE" as const,
    usuariosNotificados: 0,
    capAtingido: 0,
    semItems: 0,
    erro: e instanceof Error ? e.message : String(e),
  }));
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
