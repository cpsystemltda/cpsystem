import { NextResponse } from "next/server";
import { notificarAniversarios } from "@/lib/notificacoesWhatsapp";

/**
 * Parabéns de aniversário — todo dia às 12:00 UTC (09:00 BRT).
 *
 * Regina 28/08: "lembra da regra de dar parabéns em dia de aniversário? Lembra
 * dessa regra e nunca esqueça". A função existia desde julho e estava escrita
 * certinho — só que NINGUÉM a chamava. Não havia cron, não havia rota: nenhum
 * aniversário foi parabenizado desde que foi escrita.
 *
 * 09:00 BRT de propósito: cedo o bastante pra chegar antes do dia começar de
 * verdade, tarde o bastante pra não acordar ninguém.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }
  const inicio = Date.now();
  const resumo = await notificarAniversarios();

  // Aproveita a mesma passagem diária pra convidar quem ainda não informou a
  // data — sem esse dado a regra do aniversário não tem como funcionar.
  const { lembrarDataNascimento } = await import("@/lib/lembretePerfil");
  const lembretes = await lembrarDataNascimento().catch((e) => {
    console.error("[aniversarios] lembrete de perfil falhou:", e);
    return { criados: 0 };
  });
  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    lembretesDeDataDeNascimento: lembretes.criados,
    executadoEm: new Date().toISOString(),
  });
}
