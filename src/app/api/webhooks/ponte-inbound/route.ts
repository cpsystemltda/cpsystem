import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { avisarEquipe } from "@/lib/alertaInterno";
import { decidirRespostaIA, historicoDoUsuario } from "@/lib/ia-suporte";

/**
 * Mensagem recebida pela ponte do WhatsApp → resposta do CP System.
 *
 * Regina, 21/09/2026, pela terceira vez no mesmo dia: *"nenhum cliente fica sem
 * resposta. Eu JÁ FALEI claramente que não pode acontecer."* Estava certa: a
 * entrada de mensagens vinha por webhook da Z-API e caiu em 18/09, então desde
 * então toda resposta automática dependia de eu estar numa conversa com ela.
 *
 * O DESENHO, e o porquê dele: a ponte roda na máquina da Regina, em localhost.
 * O servidor na Vercel não alcança essa máquina — logo, não adianta o sistema
 * "responder depois", porque ele não teria por onde entregar. Então a troca é
 * **síncrona**: a ponte pergunta, este endpoint devolve o texto da resposta no
 * corpo, e quem entrega é a própria ponte, que já está conectada ao WhatsApp.
 * Nenhum servidor externo, nenhum túnel, nenhuma porta aberta.
 *
 * Regra de atendimento (a mesma do canal antigo): o que a IA sabe responder,
 * ela responde na hora; o que exige decisão — preço, prazo, funcionalidade que
 * não existe, exceção comercial — vai para o grupo de suporte e o cliente
 * recebe a confirmação de que a equipe assume.
 */
export const maxDuration = 60;

type Payload = {
  messageId?: string;
  chatJid?: string;
  sender?: string;
  pushName?: string;
  texto?: string;
};

export async function POST(req: NextRequest) {
  const segredo = process.env.PONTE_INBOUND_SECRET;
  if (segredo && req.headers.get("x-ponte-secret") !== segredo) {
    return NextResponse.json({ erro: "unauthorized" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ erro: "json inválido" }, { status: 400 });
  }

  const texto = (body.texto ?? "").trim();
  const chatJid = body.chatJid ?? "";
  const messageId = body.messageId ?? "";
  if (!texto || !chatJid) return NextResponse.json({ resposta: null });

  // Grupo não é atendimento individual — inclusive o próprio grupo de suporte,
  // que entraria em laço respondendo a si mesmo.
  if (chatJid.endsWith("@g.us")) return NextResponse.json({ resposta: null });

  // Idempotência pelo id da mensagem. A ponte pode reentregar (retry de rede),
  // e sem esta trava o cliente recebe duas respostas com redação diferente —
  // exatamente o que a Regina flagrou em 31/08 no canal antigo.
  if (messageId) {
    try {
      await prisma.mensagemInboundWhatsApp.create({
        data: { messageId, telefone: (body.sender ?? "").replace(/\D/g, "") },
      });
    } catch {
      return NextResponse.json({ resposta: null, motivo: "duplicada" });
    }
  }

  // Quem está falando? O remetente vem como telefone; o cadastro pode ter o
  // número com ou sem o nono dígito, então tenta as duas formas.
  const cru = (body.sender ?? "").replace(/\D/g, "").replace(/^55/, "");
  const ddd = cru.slice(0, 2);
  const resto = cru.slice(2);
  const variantes = Array.from(
    new Set([
      cru,
      `55${cru}`,
      resto.length === 8 ? `${ddd}9${resto}` : `${ddd}${resto.replace(/^9/, "")}`,
    ]),
  );

  const usuario = await prisma.usuario.findFirst({
    where: { telefoneWhatsApp: { in: variantes } },
    select: {
      id: true, nome: true, email: true, superAdmin: true, contaId: true,
      conta: {
        select: {
          tipo: true, statusAssinatura: true, proximoVencimento: true,
          empresas: { select: { razaoSocial: true }, take: 1 },
        },
      },
    },
  });

  // Desconhecido = lead de prospecção que respondeu. Também não fica sem
  // resposta: a equipe assume, porque é conversa de venda e não de suporte.
  if (!usuario) {
    await avisarEquipe(
      `💬 *Resposta de quem não é cliente*\n\n` +
        `De: ${body.pushName || "—"} (${body.sender})\n\n` +
        `"${texto.slice(0, 400)}"\n\n` +
        `Provavelmente lead da prospecção. Assumam a conversa.`,
    ).catch(() => {});
    return NextResponse.json({
      resposta:
        `Obrigado pelo retorno! Aqui é do CP System. ` +
        `Um de nós assume esta conversa em instantes para te atender direito.\n\n` +
        `Se a mensagem chegou por engano ou não for do seu interesse, é só dizer que encerramos por aqui.\n\n` +
        `Contato CP System`,
    });
  }

  try {
    const decisao = await decidirRespostaIA(texto, {
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: cru,
      tipoConta: usuario.conta?.tipo === "ANALISTA" ? "ANALISTA" : "EMPRESA",
      isSuperAdmin: usuario.superAdmin,
      empresaRazao: usuario.conta?.empresas[0]?.razaoSocial ?? undefined,
      statusAssinatura: usuario.conta?.statusAssinatura ?? undefined,
      proximoVencimento: usuario.conta?.proximoVencimento ?? null,
      // Histórico: sem ele a IA responde cada mensagem como se fosse a
      // primeira, e o cliente tem que repetir o contexto toda vez.
      ultimasMensagens: await historicoDoUsuario(usuario.id).catch(() => []),
    });

    if (decisao.acao === "escalar_admin") {
      await avisarEquipe(
        `🆘 *Suporte precisa de vocês*\n\n` +
          `Cliente: ${usuario.nome} (${usuario.email})\n` +
          `Categoria: ${decisao.categoria}\n\n` +
          `Mensagem: "${texto.slice(0, 400)}"\n\n` +
          `${decisao.resumoParaAdmin}`,
      ).catch(() => {});
    }

    return NextResponse.json({ resposta: decisao.resposta });
  } catch (e) {
    console.error("[ponte-inbound] IA falhou:", e);
    await avisarEquipe(
      `⚠️ *IA de suporte falhou* — responder na mão\n\n` +
        `Cliente: ${usuario.nome}\n"${texto.slice(0, 300)}"`,
    ).catch(() => {});
    // Falha da IA não pode virar silêncio: o cliente recebe o aviso de que a
    // equipe assumiu, que é melhor do que não receber nada.
    return NextResponse.json({
      resposta:
        `Recebemos sua mensagem, ${usuario.nome.split(" ")[0]}! ` +
        `Nossa equipe responde em instantes.\n\nContato CP System`,
    });
  }
}
