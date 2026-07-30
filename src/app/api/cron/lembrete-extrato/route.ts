import { NextResponse } from "next/server";
import { enviarLembreteExtratoSemanal } from "@/lib/notificacoesWhatsapp";

// Cron semanal — Vercel dispara toda sexta 13:00 UTC (10:00 BRT).
// Notifica empresas com conciliacao ativa (plano INTERMEDIARIO/PREMIUM ou
// cortesia) pra enviar o extrato bancario da semana. Regina 30/07.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await enviarLembreteExtratoSemanal();
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
