import { NextResponse } from "next/server";
import { enviarResumoSemanal } from "@/lib/notificacoesWhatsapp";

// Cron semanal — Vercel dispara toda sexta 11:00 UTC (08:00 BRT).
// Envia relatorio geral da conta pra cada usuario com opt-in WhatsApp.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await enviarResumoSemanal();
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
