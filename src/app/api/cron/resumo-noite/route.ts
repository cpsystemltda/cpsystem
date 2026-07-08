import { NextResponse } from "next/server";
import { executarResumoDaJanela } from "@/lib/notificacoesResumo";

// Cron NOITE (Regina 08/07) — 19h BRT (22h UTC). Envia msg consolidada com
// prazos D-30/D-60/D-90 (planejamento), garantias vencendo e cartao expirando.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await executarResumoDaJanela("NOITE").catch((e) => ({
    janela: "NOITE" as const,
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
