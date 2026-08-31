import { NextResponse } from "next/server";
import { reengajarContas } from "@/lib/ativacao";

/**
 * Ativação — todo dia às 13:00 UTC (10:00 BRT).
 *
 * Regina 31/08: "ele não pode só ter feito um cadastro e simplesmente sair do
 * sistema (...) nós temos que ir atrás dele. O trabalho ali tem que ser ativo,
 * não pode ser um trabalho que pare não."
 *
 * 10:00 BRT de propósito: uma hora depois do cron de aniversários (09:00), pra
 * que ninguém receba parabéns e cobrança de cadastro no mesmo minuto.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await reengajarContas();
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    executadoEm: new Date().toISOString(),
  });
}
