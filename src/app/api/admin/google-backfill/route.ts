import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sincronizarHistoricoDaConta } from "@/lib/googleCalendar";

/**
 * Manda para o Google Agenda o histórico de uma conta (ou de todas as que
 * têm agenda conectada).
 *
 * POST ?secret=&contaId=<id>[&tipos=ATA,CONTRATO]   → uma conta
 * POST ?secret=                                       → todas com Google conectado
 *
 * Regina, 22/10/2026: *"preciso que apareça na agenda todas, inclusive as
 * registradas antes."* O mesmo roda sozinho ao ligar uma opção ou conectar a
 * agenda; esta rota é para destravar sem esperar o cliente mexer. Respeita
 * as opções de cada conta Google: tipo desligado continua de fora.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  if (!process.env.CRON_SECRET || url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }
  const contaId = url.searchParams.get("contaId");
  const tiposParam = url.searchParams.get("tipos");
  const tipos = tiposParam
    ? (tiposParam.split(",").map((t) => t.trim().toUpperCase()) as Array<"EMPENHO" | "ATA" | "CONTRATO" | "GARANTIA" | "COBRANCA">)
    : undefined;

  const contas = contaId
    ? [contaId]
    : (
        await prisma.googleAccount.findMany({ select: { usuario: { select: { contaId: true } } } })
      ).map((g) => g.usuario.contaId);
  const unicas = Array.from(new Set(contas));

  const inicio = Date.now();
  const resultado: Record<string, Record<string, number> | { erro: string }> = {};
  for (const id of unicas) {
    try {
      resultado[id] = await sincronizarHistoricoDaConta(id, tipos);
    } catch (e) {
      resultado[id] = { erro: (e as Error).message.slice(0, 200) };
    }
  }
  return NextResponse.json({ ok: true, duracaoMs: Date.now() - inicio, contas: unicas.length, resultado });
}
