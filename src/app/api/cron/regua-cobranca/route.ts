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

  // Nota fiscal da mensalidade (Regina 17/10 e 21/10): liga a emissão
  // automática em quem não tem e emite o que ficou para trás. Best-effort e
  // depois da régua: nota não pode impedir cobrança, e falha aqui é avisada,
  // não engolida.
  let notaFiscal: unknown = null;
  try {
    const { rotinaNotaFiscalDiaria } = await import("@/lib/notaFiscalAutomatica");
    const nf = await rotinaNotaFiscalDiaria();
    notaFiscal = nf;
    const problemas = [
      ...nf.assinaturas.falhas,
      ...nf.pendentes.falhas,
      ...nf.sincronizacao.falhas,
      ...nf.sincronizacao.comProblema.map((p) => `nota ${p.invoiceId} em ${p.status} — precisa de nova emissão ou de olhar no painel`),
    ];
    const semMolde = nf.assinaturas.semMolde || nf.pendentes.semMolde;
    if (problemas.length || semMolde || nf.pendentes.emitidas.length || nf.sincronizacao.enviadas.length) {
      const { avisarEquipe } = await import("@/lib/alertaInterno");
      const linhas = [
        `🧾 *Nota fiscal das mensalidades*`,
        ``,
        semMolde ? `⚠️ Sem molde fiscal: nenhuma assinatura configurada e nenhuma nota autorizada no Asaas.` : `Molde: ${nf.molde}`,
        `Assinaturas: ${nf.assinaturas.jaTinham} já tinham emissão, ${nf.assinaturas.configuradas} ligadas hoje.`,
        `Notas emitidas hoje: ${nf.pendentes.emitidas.length}.`,
        `PDFs entregues pela sincronização (webhook não trouxe): ${nf.sincronizacao.enviadas.length}. Aguardando prefeitura: ${nf.sincronizacao.aguardando}.`,
        ...(problemas.length ? [``, `❌ Falhas:`, ...problemas.map((p) => `   ▫ ${p}`)] : []),
      ];
      await avisarEquipe(linhas.join("\n")).catch(() => {});
    }
  } catch (e) {
    console.error("[regua-cobranca] rotina de nota fiscal falhou:", e);
    notaFiscal = { erro: (e as Error).message.slice(0, 200) };
  }

  // Cartão das assinaturas (Regina 21/10: "nem as cobranças"): assinatura de
  // cartão sem cartão preso não cobra ninguém e ninguém fica sabendo. Aqui
  // o cliente é orientado e a equipe avisada, todo dia em que isso for verdade.
  let cartoes: unknown = null;
  try {
    const { conferirCartoesDasAssinaturas } = await import("@/lib/cartaoAssinatura");
    const c = await conferirCartoesDasAssinaturas();
    cartoes = c;
    if (c.semCartao.length || c.falhas.length) {
      const { avisarEquipe } = await import("@/lib/alertaInterno");
      await avisarEquipe(
        [
          `💳 *Assinaturas sem cartão vinculado: ${c.semCartao.length}*`,
          ...c.semCartao.map((s) => `   ▫ ${s.empresa} — ${s.clienteAvisado ? "cliente orientado hoje" : "cliente já orientado nos últimos dias"}`),
          ...(c.falhas.length ? [``, `❌ Falhas:`, ...c.falhas.map((f) => `   ▫ ${f}`)] : []),
          ``,
          `Sem cartão, a mensalidade não é debitada: o cliente precisa pagar por PIX ou recadastrar o cartão em Conta › Assinatura.`,
        ].join("\n"),
      ).catch(() => {});
    }
  } catch (e) {
    console.error("[regua-cobranca] conferência de cartões falhou:", e);
    cartoes = { erro: (e as Error).message.slice(0, 200) };
  }

  return NextResponse.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    resumo,
    notaFiscal,
    cartoes,
    executadoEm: new Date().toISOString(),
  });
}
