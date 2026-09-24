import { NextResponse } from "next/server";
import { conferirOperacao, montarTextoSentinela } from "@/lib/sentinela";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Sentinela — duas vezes por dia, o sistema presta contas.
 *
 * Regina, 24/09/2026: *"eu não tenho que ficar te lembrando disso. Isso tem
 * que estar na sua programação diária."*
 *
 * 11:00 UTC (08:00 BRT): antes do dia começar de verdade, para pegar o que
 * quebrou durante a noite — é quando a Z-API caiu e ninguém viu.
 * 21:00 UTC (18:00 BRT): fechamento, para nenhum dia terminar sem alguém
 * saber o que saiu.
 *
 * Manda no grupo **inclusive quando está tudo certo**. Relatório que só
 * aparece em dia ruim é relatório que ninguém sabe se está funcionando — e
 * foi exatamente assim que uma semana inteira de silêncio passou despercebida.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  const relatorio = await conferirOperacao();
  await avisarEquipe(montarTextoSentinela(relatorio)).catch((e) =>
    console.error("[sentinela] não consegui avisar a equipe:", e),
  );

  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    tudoCerto: relatorio.tudoCerto,
    achados: relatorio.achados.length,
    executadoEm: new Date().toISOString(),
  });
}
