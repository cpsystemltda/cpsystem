import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * "Já respondi essa conversa" — avisado pela ponte a cada mensagem que sai.
 *
 * Regina, 24/09/2026: *"eu falei para você gravar que NINGUÉM fica sem
 * resposta."* A regra existia e mesmo assim o Igor ficou sem retorno, porque
 * depender de alguém perceber é o mesmo que não ter regra.
 *
 * O servidor sabe o que CHEGOU (a ponte encaminha), mas não sabia o que
 * SAIU — mensagem que eu mando pelo MCP, ou que a Regina digita no aparelho,
 * nunca passava por ele. Sem isso, qualquer cobrança de "sem resposta" ia
 * acusar conversa já respondida, viraria ruído e seria ignorada em uma semana.
 *
 * Agora a ponte avisa a cada envio, e a cobrança só sobra para quem realmente
 * ficou esperando. Não importa QUEM respondeu — importa que respondeu.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const segredo = process.env.PONTE_INBOUND_SECRET;
  if (segredo && req.headers.get("x-ponte-secret") !== segredo) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  let body: { chatJid?: string; telefone?: string };
  try {
    body = (await req.json()) as { chatJid?: string; telefone?: string };
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400 });
  }

  const chatJid = (body.chatJid ?? "").trim();
  const telefone = (body.telefone ?? "").replace(/\D/g, "");
  if (!chatJid && !telefone) return NextResponse.json({ ok: true, marcadas: 0 });

  const r = await prisma.mensagemInboundWhatsApp.updateMany({
    where: {
      respondidaEm: null,
      ...(chatJid ? { chatJid } : { telefone: { contains: telefone.slice(-8) } }),
    },
    data: { respondidaEm: new Date() },
  });

  return NextResponse.json({ ok: true, marcadas: r.count });
}
