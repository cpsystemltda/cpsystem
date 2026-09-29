import { NextResponse } from "next/server";
import { sincronizarPortal } from "@/lib/portal/sincronizar";

/**
 * Portal da Transparência — uma leitura por dia, de madrugada.
 *
 * Roda às 05h de Brasília (08:00 UTC) por dois motivos: os arquivos do dia
 * anterior já estão publicados, e é a faixa em que o portal está ocioso.
 *
 * Lê as notas fiscais do mês corrente e as despesas dos últimos dias. A
 * janela curta existe porque a CGU publica com alguns dias de atraso — reler
 * é o que garante não perder documento, e o `upsert` faz a releitura sair de
 * graça.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const esperado = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== esperado) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  try {
    const r = await sincronizarPortal({ diasDeDespesa: 4 });
    return NextResponse.json({ ok: true, duracaoMs: Date.now() - inicio, ...r });
  } catch (e) {
    console.error("[portal] sincronização falhou:", e);
    return NextResponse.json(
      { ok: false, erro: (e as Error).message, duracaoMs: Date.now() - inicio },
      { status: 500 },
    );
  }
}
