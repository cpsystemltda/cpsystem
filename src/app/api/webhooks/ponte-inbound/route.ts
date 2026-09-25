import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  /** Telefone de verdade. `sender` pode vir como LID, que não casa com cadastro. */
  senderTelefone?: string;
  pushName?: string;
  texto?: string;
  /** Alguém da equipe está atendendo esta conversa agora. */
  humanoNoComando?: boolean;
  /** O fio da conversa no WhatsApp, do mais antigo pro mais novo. */
  conversa?: { autor?: string; texto?: string; quando?: string }[];
};

/**
 * Aviso interno sai pela PONTE, não pela Z-API.
 *
 * `avisarEquipe` usa `enviarTexto`, que é Z-API — vencida desde 18/09. O aviso
 * de "cliente pedindo reunião" foi postado lá e morreu no caminho, sem erro
 * visível para ninguém. Aqui o aviso volta no corpo da resposta e quem entrega
 * é a ponte, que é o canal que está de pé.
 */
function avisoParaEquipe(texto: string): { destino: string; texto: string }[] {
  const grupo = (process.env.SUPORTE_GROUP_ID || "").trim();
  if (!grupo) return [];

  // `SUPORTE_GROUP_ID` está gravado no formato da Z-API (`...-group`), que é
  // invenção dela — a ponte fala JID. Sem esta tradução o aviso era gerado,
  // devolvido e entregue em um endereço que não existe: o grupo de suporte
  // passou três dias mudo enquanto o sistema achava que estava avisando.
  const destino = grupo.includes("@")
    ? grupo
    : `${grupo.replace(/-group$/, "").replace(/\D/g, "")}@g.us`;

  return [{ destino, texto }];
}

/**
 * Já prometemos retorno nesta conversa?
 *
 * Quando a IA escala, a única coisa que ela tem pra dizer ao cliente é "a
 * equipe retorna". Dita duas vezes, isso deixa de ser atendimento e vira
 * insistência — foi o que a Claudiamara recebeu, a mesma frase repetida
 * enquanto negociava horário com a Regina.
 *
 * Instrução no prompt não basta: o modelo preenche o campo por hábito. Aqui a
 * regra é de código, e o cliente continua atendido — a equipe é avisada do
 * mesmo jeito, só não recebe mais um bilhete automático dizendo o óbvio.
 */
function jaPrometemosRetorno(
  conversa: { autor: string; conteudo: string }[],
): boolean {
  const nossas = conversa.filter((m) => m.autor === "sistema").slice(-3);
  return nossas.some((m) =>
    /(retorn|verificando a disponibilidade|em breve|nossa equipe|um administrador|assume esta conversa)/i.test(
      m.conteudo,
    ),
  );
}

async function marcarRespondida(messageId: string, ehSuperAdmin = false): Promise<void> {
  await prisma.mensagemInboundWhatsApp
    .update({
      where: { messageId },
      data: { respondidaEm: new Date(), ...(ehSuperAdmin ? { ehSuperAdmin: true } : {}) },
    })
    .catch(() => {});
}

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

  // ── Grupos ────────────────────────────────────────────────────────────────
  //
  // Grupo não é atendimento individual, e o robô não pode entrar em laço
  // respondendo a si mesmo. Mas o GRUPO DE SUPORTE é outra coisa: é onde a
  // Regina e o Igor decidem.
  //
  // Regina, 24/09/2026: *"o grupo de suporte é um grupo de super admin,
  // portanto o que ficar acordado por lá deve ser feito."* Ela autorizou duas
  // coisas ali e ficou sem retorno — porque esta linha descartava tudo que
  // vinha de grupo, inclusive a decisão dela.
  if (chatJid.endsWith("@g.us")) {
    const grupoSuporte = (process.env.SUPORTE_GROUP_ID || "").replace(/\D/g, "");
    const esteGrupo = chatJid.replace(/\D/g, "");
    const ehSuporte = !!grupoSuporte && esteGrupo.startsWith(grupoSuporte);

    // Registra a decisão para virar tarefa, e confirma o recebimento. Sem o
    // registro, "o que ficar acordado por lá deve ser feito" depende de
    // alguém ter lido — que é exatamente o que falhou.
    // `upsert`, não `update`: esta checagem roda ANTES do registro de
    // idempotência ser criado, então aqui a linha ainda não existe. Com
    // `update` a gravação falhava calada — e a decisão continuava sumindo,
    // que era exatamente o defeito que eu vim consertar.
    if (ehSuporte && messageId) {
      await prisma.mensagemInboundWhatsApp
        .upsert({
          where: { messageId },
          create: {
            messageId,
            telefone: (body.sender ?? "").replace(/\D/g, ""),
            chatJid,
            texto: texto.slice(0, 2000),
            pushName: body.pushName || null,
            ehSuperAdmin: true,
          },
          update: {
            chatJid,
            texto: texto.slice(0, 2000),
            pushName: body.pushName || null,
            ehSuperAdmin: true,
          },
        })
        .catch((e) => console.error("[ponte-inbound] não gravei a decisão do grupo:", e));
    }
    if (!ehSuporte) return NextResponse.json({ resposta: null, motivo: "grupo" });

    // Responde NA HORA, no próprio grupo. Regina 25/09: *"eu quero respostas
    // na hora, você antes fazia isso e eu não aceito regressão."* Em conversa
    // individual a resposta sempre saiu em segundos; o grupo é que estava
    // mudo. Laço não é risco: a ponte nunca reencaminha mensagem nossa.
    const { responderInstrucaoInterna } = await import("@/lib/instrucaoInterna");
    const resposta = await responderInstrucaoInterna({
      texto,
      autor: body.pushName || "equipe",
      historico: (body.conversa ?? [])
        .filter((m) => (m.texto ?? "").trim())
        .slice(-6)
        .map((m) => ({
          autor: m.autor === "nos" ? "sistema" : "pessoa",
          conteudo: String(m.texto).slice(0, 700),
        })),
    });

    if (messageId) await marcarRespondida(messageId, true);
    return NextResponse.json({ resposta, motivo: "decisao_registrada" });
  }

  // Idempotência pelo id da mensagem. A ponte pode reentregar (retry de rede),
  // e sem esta trava o cliente recebe duas respostas com redação diferente —
  // exatamente o que a Regina flagrou em 31/08 no canal antigo.
  if (messageId) {
    try {
      await prisma.mensagemInboundWhatsApp.create({
        data: {
          messageId,
          telefone: (body.senderTelefone || body.sender || "").replace(/\D/g, ""),
          chatJid,
          // O texto fica guardado porque o alerta de "ninguém respondeu" só
          // serve se disser O QUE a pessoa perguntou.
          texto: texto.slice(0, 2000),
          pushName: body.pushName || null,
        },
      });
    } catch {
      return NextResponse.json({ resposta: null, motivo: "duplicada" });
    }
  }

  // Mensagem só com mídia: a ponte manda "[audio recebido]". Não dá pra
  // responder o conteúdo — ninguém aqui ouviu —, mas dá pra não deixar a
  // pessoa no vácuo e pra avisar quem precisa ouvir. Regina 25/09, com dois
  // áudios parados: áudio é como muita gente fala; tratar como silêncio é
  // perder a conversa.
  const soMidia = /^\[(audio|image|video|document) recebido\]$/.exec(texto);
  if (soMidia) {
    const tipo = soMidia[1];
    const nome = { audio: "áudio", image: "imagem", video: "vídeo", document: "documento" }[tipo] ?? tipo;
    if (messageId) await marcarRespondida(messageId);
    return NextResponse.json({
      resposta:
        `Recebemos seu ${nome}, ${(body.pushName || "").split(" ")[0] || "tudo bem"}! ` +
        `Nossa equipe vai ouvir e retornar em seguida.\n\n` +
        `Se preferir adiantar, pode escrever por aqui que já respondo.\n\n` +
        `Contato CP System`,
      avisos: avisoParaEquipe(
        `🎧 *${nome.charAt(0).toUpperCase() + nome.slice(1)} recebido — precisa de gente*\n\n` +
          `De: ${body.pushName || "—"} (${body.senderTelefone || body.sender})\n\n` +
          `O sistema não transcreve ${nome}. Alguém precisa ouvir e responder.`,
      ),
    });
  }

  // Conversa com gente da equipe dentro: o robô não fala por cima.
  //
  // Regina, 21/09/2026, negociando horário com a C2Vendas enquanto a resposta
  // automática repetia "um de nós assume esta conversa em instantes" para a
  // mesma cliente: *"você está prejudicando a sequência que já tinha dado
  // certo."* A equipe continua sendo avisada — o que para é a fala do robô.
  if (body.humanoNoComando) {
    // Calar não é abandonar: a equipe vê a mensagem no grupo e segue a
    // conversa. Silêncio sem registro seria a regra de "ninguém fica sem
    // resposta" quebrando pela porta dos fundos.
    return NextResponse.json({
      resposta: null,
      motivo: "humano_no_comando",
      avisos: avisoParaEquipe(
        `💬 *Mensagem numa conversa que vocês estão atendendo*\n\n` +
          `De: ${body.pushName || "—"} (${body.senderTelefone || body.sender})\n\n` +
          `"${texto.slice(0, 400)}"\n\n` +
          `Não respondi automaticamente para não atravessar o atendimento.`,
      ),
    });
  }

  // Quem está falando? O telefone vem em `senderTelefone`; `sender` pode ser um
  // LID (`280431333220532`), que não é telefone de ninguém e não casa com
  // cadastro nenhum. Foi assim que a Claudiamara, cliente em teste, caiu como
  // desconhecida e recebeu o texto fixo em vez da IA com o contexto dela.
  const cru = (body.senderTelefone || body.sender || "")
    .replace(/\D/g, "")
    .replace(/^55/, "");
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

  // O fio da conversa como está no WhatsApp. É o que impede a IA de tratar
  // "Ideal seria 17 na quarta" como se fosse a primeira frase de um estranho.
  const conversa = (body.conversa ?? [])
    .filter((m) => (m.texto ?? "").trim())
    .slice(-14)
    .map((m) => ({
      autor: m.autor === "nos" ? ("sistema" as const) : ("cliente" as const),
      conteudo: String(m.texto).slice(0, 700),
    }));

  const quemEscreve = body.pushName || "—";

  // ── Super admin não é cliente ────────────────────────────────────────────
  //
  // Regina, 24/09/2026: *"separe o que é pedido de super admin e de cliente —
  // o Igor é super admin junto comigo."*
  //
  // O que motivou: o Igor mandou "alterações validadas" e, junto, um pedido de
  // produto (avisar toda a base das novidades por WhatsApp e por pop-up no
  // login). A IA de suporte tratou aquilo como chamado de cliente e respondeu
  // com cortesia genérica. O pedido dele não chegou a ninguém.
  //
  // Sócio não abre chamado: ele dá instrução. Então nada de resposta de
  // suporte — o texto vai inteiro para o grupo, para virar decisão, e ele
  // recebe só a confirmação de que foi registrado.
  if (usuario?.superAdmin) {
    if (messageId) await marcarRespondida(messageId, true);
    return NextResponse.json({
      resposta:
        `Recebido, ${usuario.nome.split(" ")[0]} — registrado e levado para a equipe.

` +
        `Contato CP System`,
      avisos: avisoParaEquipe(
        `🛠️ *Instrução interna — ${usuario.nome}*

` +
          `"${texto.slice(0, 900)}"

` +
          `Não é chamado de cliente: é pedido de quem administra a plataforma.`,
      ),
    });
  }

  try {
    const decisao = await decidirRespostaIA(texto, {
      usuarioId: usuario?.id ?? "",
      nome: usuario?.nome ?? quemEscreve,
      email: usuario?.email ?? "",
      telefone: cru,
      tipoConta: usuario?.conta?.tipo === "ANALISTA" ? "ANALISTA" : "EMPRESA",
      isSuperAdmin: usuario?.superAdmin ?? false,
      empresaRazao: usuario?.conta?.empresas[0]?.razaoSocial ?? undefined,
      statusAssinatura: usuario?.conta?.statusAssinatura ?? undefined,
      proximoVencimento: usuario?.conta?.proximoVencimento ?? null,
      // Quem não está no cadastro é lead: a IA responde do mesmo jeito, mas
      // sabendo que não pode falar de conta, fatura ou dado de ninguém.
      semCadastro: !usuario,
      // Duas memórias, e as duas importam: o que o sistema já mandou por
      // notificação, e a conversa real deste WhatsApp.
      ultimasMensagens: [
        ...conversa,
        ...(usuario ? await historicoDoUsuario(usuario.id).catch(() => []) : []),
      ],
    });

    const avisos: { destino: string; texto: string }[] = [];
    // Escalar de novo numa conversa onde já prometemos retorno: a equipe é
    // avisada, o cliente não recebe a mesma frase pela segunda vez.
    const calar =
      decisao.acao === "escalar_admin" && jaPrometemosRetorno(conversa);
    if (decisao.acao === "escalar_admin") {
      avisos.push(
        ...avisoParaEquipe(
          `🆘 *Suporte precisa de vocês*\n\n` +
            `${usuario ? `Cliente: ${usuario.nome} (${usuario.email})` : `Fora do cadastro: ${quemEscreve} (${cru})`}\n` +
            `Categoria: ${decisao.categoria}\n\n` +
            `Mensagem: "${texto.slice(0, 400)}"\n\n` +
            `${decisao.resumoParaAdmin}\n\n` +
            (calar
              ? `Nada foi respondido a ele — já prometemos retorno antes nesta conversa. Ele está esperando gente.`
              : `Respondido a ele: "${decisao.resposta.slice(0, 200)}"`),
        ),
      );
    }

    // Respondeu agora? Então esta mensagem não entra na cobrança de
    // "ninguém sem resposta".
    if (!calar && messageId) await marcarRespondida(messageId);

    return NextResponse.json({
      resposta: calar ? null : decisao.resposta,
      avisos,
    });
  } catch (e) {
    console.error("[ponte-inbound] IA falhou:", e);
    const primeiroNome = (usuario?.nome ?? quemEscreve).split(" ")[0];
    // Falha da IA não pode virar silêncio: a equipe é chamada e o cliente
    // recebe uma linha honesta, sem prometer prazo que ninguém garantiu.
    return NextResponse.json({
      resposta:
        `Recebemos sua mensagem, ${primeiroNome}! ` +
        `Nossa equipe responde em instantes.\n\nContato CP System`,
      avisos: avisoParaEquipe(
        `⚠️ *IA de suporte falhou* — responder na mão\n\n` +
          `${usuario ? `Cliente: ${usuario.nome}` : `Fora do cadastro: ${quemEscreve} (${cru})`}\n` +
          `"${texto.slice(0, 300)}"`,
      ),
    });
  }
}
