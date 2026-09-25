import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Ninguém fica sem resposta — cobrado de 15 em 15 minutos.
 *
 * Regina, 24/09/2026, pela quarta vez na semana: *"eu falei para você gravar
 * que NINGUÉM fica sem resposta. Está difícil de entender?"*
 *
 * A regra existia desde 21/09 e mesmo assim o Igor escreveu às 21:49 e ficou
 * sem retorno. O motivo é sempre o mesmo: regra que depende de alguém perceber
 * não é regra, é sorte. Este cron é a percepção automatizada.
 *
 * Como funciona: a ponte registra o que CHEGA e avisa o que SAI, de qualquer
 * origem — resposta automática, envio pelo MCP ou mensagem digitada no
 * aparelho. Passados 20 minutos sem nada sair naquela conversa, a equipe é
 * cobrada no grupo, com o texto da pergunta junto. Cada mensagem é cobrada uma
 * vez só; insistir viraria ruído e ruído é ignorado.
 */
export const dynamic = "force-dynamic";

const MINUTOS_DE_TOLERANCIA = 20;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ ok: false, erro: "Não autorizado" }, { status: 401 });
  }

  const limite = new Date(Date.now() - MINUTOS_DE_TOLERANCIA * 60_000);
  const esquecidas = await prisma.mensagemInboundWhatsApp.findMany({
    where: {
      respondidaEm: null,
      cobradaEm: null,
      criadoEm: { lt: limite, gte: new Date(Date.now() - 48 * 3600_000) },
      // Mensagem sem texto é confirmação de leitura, figurinha ou mídia que a
      // ponte não transcreveu — cobrar isso seria gritar à toa.
      texto: { not: null },
    },
    orderBy: { criadoEm: "asc" },
    take: 20,
    select: { id: true, texto: true, pushName: true, telefone: true, criadoEm: true, ehSuperAdmin: true },
  });

  if (esquecidas.length === 0) {
    return NextResponse.json({ ok: true, pendentes: 0 });
  }

  const minutos = (d: Date) => Math.round((Date.now() - d.getTime()) / 60_000);
  const texto =
    `🔔 *${esquecidas.length === 1 ? "Uma mensagem" : `${esquecidas.length} mensagens`} sem resposta*\n\n` +
    esquecidas
      .map(
        (m) =>
          `▫ *${m.pushName || m.telefone}*${m.ehSuperAdmin ? " (interno)" : ""} — há ${minutos(m.criadoEm)} min\n` +
          `   "${(m.texto ?? "").slice(0, 220)}"`,
      )
      .join("\n\n") +
    `\n\nNinguém fica sem resposta. Respondam por aqui que o aviso para sozinho.`;

  await avisarEquipe(texto).catch((e) => console.error("[sem-resposta] falhou ao avisar:", e));

  await prisma.mensagemInboundWhatsApp.updateMany({
    where: { id: { in: esquecidas.map((m) => m.id) } },
    data: { cobradaEm: new Date() },
  });

  return NextResponse.json({ ok: true, pendentes: esquecidas.length });
}
