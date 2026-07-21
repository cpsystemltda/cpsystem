import { NextResponse } from "next/server";
import { limparTentativasAntigas } from "@/lib/rateLimitLogin";

// Cron diario — apaga tentativas com >30d.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const r = await limparTentativasAntigas();
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    removidas: r.removidas,
    executadoEm: new Date().toISOString(),
  });
}
