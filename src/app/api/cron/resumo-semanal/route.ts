import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTexto } from "@/lib/whatsapp";
import {
  montarResumoEmpresa,
  montarResumoAnalista,
  semanaIso,
} from "@/lib/resumoSemanal";

// Cron semanal — segunda 12h UTC (9h BRT).
// Regina 14/07: 1 msg/semana consolidada pra cada cliente EMPRESA + cada
// ANALISTA. Anti-spam via chave (usuarioId, tipo, referenciaId=semana ISO).
//
// Rate-limit interno: 2s entre envios pra evitar burst.
// Kill switch: WHATSAPP_KILL_SWITCH=1 desativa TODOS os envios.

const RATE_LIMIT_MS = 2000;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  if (process.env.WHATSAPP_KILL_SWITCH === "1") {
    return NextResponse.json({ erro: "kill switch ativo", skipped: true });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const semana = semanaIso();
  const resultados: { tipo: string; alvo: string; status: string; motivo?: string; messageId?: string }[] = [];

  // ------- Empresas -------
  const contas = await prisma.conta.findMany({
    where: {
      tipo: "EMPRESA",
      statusAssinatura: { in: ["ATIVA", "TRIAL", "INADIMPLENTE"] },
      usuarios: { some: { superAdmin: false, optInWhatsApp: true, telefoneWhatsApp: { not: null } } },
    },
    select: { id: true },
  });

  for (const c of contas) {
    const resumo = await montarResumoEmpresa(c.id);
    if (!resumo) { resultados.push({ tipo: "empresa", alvo: c.id, status: "sem_dados" }); continue; }

    // Idempotencia: ja enviamos essa semana pra esse usuario?
    const existente = await prisma.notificacaoWhatsApp.findUnique({
      where: { usuarioId_tipo_referenciaId: {
        usuarioId: resumo.usuarioAdminId,
        tipo: "RESUMO_SEMANAL_EMPRESA",
        referenciaId: semana,
      } },
      select: { status: true },
    });
    if (existente?.status === "ENVIADA") { resultados.push({ tipo: "empresa", alvo: c.id, status: "ja_enviada" }); continue; }

    if (dryRun) { resultados.push({ tipo: "empresa", alvo: c.id, status: "dryRun_ok" }); continue; }

    const reg = await prisma.notificacaoWhatsApp.upsert({
      where: { usuarioId_tipo_referenciaId: { usuarioId: resumo.usuarioAdminId, tipo: "RESUMO_SEMANAL_EMPRESA", referenciaId: semana } },
      create: { usuarioId: resumo.usuarioAdminId, tipo: "RESUMO_SEMANAL_EMPRESA", referenciaId: semana, telefone: resumo.telefone, mensagem: resumo.mensagem.slice(0, 4000), status: "PENDENTE" },
      update: { mensagem: resumo.mensagem.slice(0, 4000), status: "PENDENTE", erro: null },
    });
    try {
      const r = await enviarTexto(resumo.telefone, resumo.mensagem);
      await prisma.notificacaoWhatsApp.update({ where: { id: reg.id }, data: { status: "ENVIADA", enviadaEm: new Date(), erro: null } });
      resultados.push({ tipo: "empresa", alvo: c.id, status: "enviado", messageId: r.messageId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.notificacaoWhatsApp.update({ where: { id: reg.id }, data: { status: "FALHOU", erro: msg.slice(0, 500) } });
      resultados.push({ tipo: "empresa", alvo: c.id, status: "falhou", motivo: msg.slice(0, 200) });
      // Se Z-API caiu, para tudo — nao insistir
      if (msg.includes("desconectada")) return NextResponse.json({ semana, resultados, abortado: "zapi_offline" }, { status: 500 });
    }
    await new Promise((res) => setTimeout(res, RATE_LIMIT_MS));
  }

  // ------- Analistas -------
  const analistas = await prisma.analista.findMany({ select: { id: true } });

  for (const a of analistas) {
    const resumo = await montarResumoAnalista(a.id);
    if (!resumo) { resultados.push({ tipo: "analista", alvo: a.id, status: "sem_dados" }); continue; }

    const existente = await prisma.notificacaoWhatsApp.findUnique({
      where: { usuarioId_tipo_referenciaId: {
        usuarioId: resumo.usuarioId,
        tipo: "RESUMO_SEMANAL_ANALISTA",
        referenciaId: semana,
      } },
      select: { status: true },
    });
    if (existente?.status === "ENVIADA") { resultados.push({ tipo: "analista", alvo: a.id, status: "ja_enviada" }); continue; }

    if (dryRun) { resultados.push({ tipo: "analista", alvo: a.id, status: "dryRun_ok" }); continue; }

    const reg = await prisma.notificacaoWhatsApp.upsert({
      where: { usuarioId_tipo_referenciaId: { usuarioId: resumo.usuarioId, tipo: "RESUMO_SEMANAL_ANALISTA", referenciaId: semana } },
      create: { usuarioId: resumo.usuarioId, tipo: "RESUMO_SEMANAL_ANALISTA", referenciaId: semana, telefone: resumo.telefone, mensagem: resumo.mensagem.slice(0, 4000), status: "PENDENTE" },
      update: { mensagem: resumo.mensagem.slice(0, 4000), status: "PENDENTE", erro: null },
    });
    try {
      const r = await enviarTexto(resumo.telefone, resumo.mensagem);
      await prisma.notificacaoWhatsApp.update({ where: { id: reg.id }, data: { status: "ENVIADA", enviadaEm: new Date(), erro: null } });
      resultados.push({ tipo: "analista", alvo: a.id, status: "enviado", messageId: r.messageId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.notificacaoWhatsApp.update({ where: { id: reg.id }, data: { status: "FALHOU", erro: msg.slice(0, 500) } });
      resultados.push({ tipo: "analista", alvo: a.id, status: "falhou", motivo: msg.slice(0, 200) });
      if (msg.includes("desconectada")) return NextResponse.json({ semana, resultados, abortado: "zapi_offline" }, { status: 500 });
    }
    await new Promise((res) => setTimeout(res, RATE_LIMIT_MS));
  }

  return NextResponse.json({ semana, resultados, total: resultados.length });
}
