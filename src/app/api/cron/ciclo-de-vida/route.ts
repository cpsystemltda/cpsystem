import { NextResponse } from "next/server";
import { rodarCicloDeVida } from "@/lib/cicloDeVida";
import { avisarEquipe } from "@/lib/alertaInterno";
import { montarLembreteFollowUp } from "@/lib/followUpClientes";

/** Segunda-feira no fuso de Brasília — o dia em que a equipe planeja a semana. */
function ehSegundaBRT(d: Date): boolean {
  return d.toLocaleDateString("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }) === "Mon";
}

/**
 * Ciclo de vida das contas — 14:00 UTC (11:00 BRT), todo dia.
 *
 * 11h de propósito: depois da prospecção (09h) e da ativação (10h), para que
 * ninguém receba empurrão de ativação e aviso de encerramento no mesmo minuto.
 *
 * Toda ação com consequência — arquivar, apagar — é relatada no grupo com nome
 * e motivo. Conta some da carteira da Regina só com registro de por quê.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();
  const r = await rodarCicloDeVida();

  const houveAcao = r.avisadas + r.arquivadas + r.apagadas + r.reengajadas + r.analistasCobrados > 0;
  if (houveAcao) {
    await avisarEquipe(
      `♻️ *Ciclo de vida das contas*\n\n` +
        `Avaliadas: ${r.avaliadas}\n` +
        `Avisos de inatividade: ${r.avisadas}\n` +
        `Analistas cobrados: ${r.analistasCobrados}\n` +
        `Reengajamentos (quem paga): ${r.reengajadas}\n` +
        `Arquivadas: ${r.arquivadas}\n` +
        `Apagadas: ${r.apagadas}\n\n` +
        r.detalhes.map((d) => `▫ ${d}`).join("\n"),
    ).catch(() => {});
  }

  // Follow-up de clientes (Igor 30/10): toda segunda, quem está na vez de
  // receber a conversa de relacionamento. Pega carona neste cron em vez de
  // ganhar um próprio — cada cron novo é custo de infra
  // ([[feedback-cadencia-de-cron-tem-custo-de-infra]]). `?followup=1` força
  // fora de segunda, para testar.
  const url = new URL(req.url);
  let lembreteFollowUp: string | null = null;
  if (ehSegundaBRT(new Date()) || url.searchParams.get("followup") === "1") {
    lembreteFollowUp = await montarLembreteFollowUp().catch((e) => {
      console.error("[ciclo-de-vida] lembrete de follow-up falhou:", e);
      return null;
    });
    if (lembreteFollowUp) await avisarEquipe(lembreteFollowUp).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo: r,
    followUp: lembreteFollowUp ? "lembrete enviado" : "sem lembrete",
    executadoEm: new Date().toISOString(),
  });
}
