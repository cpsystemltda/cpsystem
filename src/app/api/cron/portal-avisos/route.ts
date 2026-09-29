import { NextResponse } from "next/server";
import { avisarNovidadesDoPortal } from "@/lib/portal/avisos";

/**
 * Avisa o cliente do que o órgão publicou — às 10h de Brasília.
 *
 * Separado da sincronização de propósito. A leitura do portal roda às 5h,
 * quando os arquivos do dia anterior já estão no ar; mandar WhatsApp naquela
 * hora seria acordar o cliente para dizer que uma nota foi liquidada.
 *
 * Só recebe quem tem Intermediário, Premium ou cortesia ativa — a mesma trava
 * da conciliação por extrato, aplicada dentro de `avisarNovidadesDoPortal`.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const esperado = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== esperado) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  try {
    const r = await avisarNovidadesDoPortal();
    return NextResponse.json({ ok: true, duracaoMs: Date.now() - inicio, ...r });
  } catch (e) {
    console.error("[portal-avisos] falhou:", e);
    return NextResponse.json({ ok: false, erro: (e as Error).message }, { status: 500 });
  }
}
