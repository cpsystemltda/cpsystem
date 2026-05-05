import { NextResponse } from "next/server";
import { executarRegua } from "@/lib/regua";

// Endpoint disparado pelo Vercel Cron diariamente às 09:00 UTC (06:00 BRT).
// O Vercel Cron envia o header `Authorization: Bearer ${CRON_SECRET}` quando
// a env CRON_SECRET está configurada — por isso checamos esse header.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  // Em desenvolvimento (sem CRON_SECRET) permite chamadas locais
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await executarRegua();
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
