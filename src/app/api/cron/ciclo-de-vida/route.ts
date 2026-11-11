import { NextResponse } from "next/server";
import { rodarCicloDeVida } from "@/lib/cicloDeVida";
import { avisarEquipe } from "@/lib/alertaInterno";
import { montarLembreteFollowUp, enviarConvitesFollowUp } from "@/lib/followUpClientes";
import { rodarGeracaoDiaria } from "@/lib/competenciasServer";
import { rodarRetencaoColaboradores } from "@/lib/colaboradoresServer";
import { apurarColaboradoresDoDia } from "@/lib/faixasTerceirizacaoServer";
import { monitorarCobrancas, textoDoMonitor } from "@/lib/monitorCobrancas";

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

  // Convite de follow-up: todo dia, para quem entrou na janela do marco e
  // ainda não recebeu. A equipe fica sabendo quando algum sai, para esperar
  // a resposta no WhatsApp da empresa.
  const convites = await enviarConvitesFollowUp().catch((e) => {
    console.error("[ciclo-de-vida] convites de follow-up falharam:", e);
    return { enviados: [] as string[], pulados: { erro: 1 } };
  });
  if (convites.enviados.length > 0) {
    await avisarEquipe(
      `📨 *Convite de follow-up enviado*\n\n` +
        convites.enviados.map((n) => `▫ ${n}`).join("\n") +
        `\n\nSe responder, a conversa é marcada pelo WhatsApp da CP System. Registro em cpsystem.app.br/follow-up`,
    ).catch(() => {});
  }

  // Competências mensais (ESP-004 RN01): abre a do mês em cada contrato de
  // mão de obra com valores confirmados. Pega carona aqui pelo mesmo motivo
  // do follow-up — cron novo é custo de infra.
  const competencias = await rodarGeracaoDiaria().catch((e) => {
    console.error("[ciclo-de-vida] geração de competências falhou:", e);
    return { contratos: 0, criadas: 0, detalhes: [`falhou: ${e instanceof Error ? e.message : String(e)}`] };
  });
  if (competencias.criadas > 0) {
    await avisarEquipe(
      `📅 *Competências do mês abertas*\n\n` + competencias.detalhes.map((d) => `▫ ${d}`).join("\n"),
    ).catch(() => {});
  }

  // LGPD (ESP-007 RN07 / ESP-008): aviso 30 dias antes e anonimização de
  // colaboradores desligados além do prazo de retenção da conta.
  const retencao = await rodarRetencaoColaboradores().catch((e) => {
    console.error("[ciclo-de-vida] retenção de colaboradores falhou:", e);
    return { avisados: 0, anonimizados: 0, detalhes: [`falhou: ${e instanceof Error ? e.message : String(e)}`] };
  });
  if (retencao.anonimizados > 0 || retencao.avisados > 0) {
    await avisarEquipe(`🔒 *Retenção de dados de colaboradores*\n\n` + retencao.detalhes.map((d) => `▫ ${d}`).join("\n")).catch(() => {});
  }

  // ESP-011 RN03: pico diário de colaboradores ativos por conta (faixa do mês).
  const faixas = await apurarColaboradoresDoDia().catch((e) => {
    console.error("[ciclo-de-vida] apuração de colaboradores falhou:", e);
    return { contas: 0, avisos: 0, detalhes: [`falhou: ${e instanceof Error ? e.message : String(e)}`] };
  });

  // Regina 10/11/2026: monitor das cobranças no Asaas (só aponta, não altera).
  const monitor = await monitorarCobrancas().catch((e) => ({ ok: false as const, erro: e instanceof Error ? e.message : String(e), problemas: [], conferidas: 0 }));
  const textoMonitor = textoDoMonitor(monitor);
  if (textoMonitor) await avisarEquipe(textoMonitor).catch(() => {});

  return NextResponse.json({
    ok: true,
    faixas,
    monitorCobrancas: { conferidas: monitor.conferidas, problemas: monitor.problemas.length },
    duracaoMs: Date.now() - inicio,
    resumo: r,
    followUp: lembreteFollowUp ? "lembrete enviado" : "sem lembrete",
    convites,
    competencias,
    retencao,
    executadoEm: new Date().toISOString(),
  });
}
