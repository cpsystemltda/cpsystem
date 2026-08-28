import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTexto, variantesTelefone } from "@/lib/whatsapp";
import { decidirRespostaIA, historicoDoUsuario } from "@/lib/ia-suporte";
import { interpretarMsgAdmin, idCurto } from "@/lib/ia-decisao-grupo";
import { contaTemAcessoConciliacao } from "@/lib/conciliacao/planoGuard";
import { processarExtrato } from "@/lib/conciliacao/processar";

// Webhook Z-API — mensagens INBOUND de clientes.
// Regina 14/07: cliente manda WA -> IA analisa -> responde direto OU
// escala pra admin (Regina/Igor). Nunca dispara envio sem antes ter
// classificado.
//
// Configuracao no painel Z-API:
//   URL: https://cpsystem.app.br/api/webhooks/zapi-inbound
//   Evento: "Ao receber mensagem"
//
// Anti-loop: ignora mensagens que ESTE numero enviou (fromMe:true).
// Anti-spam: cria ChamadoSuporte + MensagemChamado pra ter idempotencia
// e historico. Se ja processou o mesmo messageId, no-op.

type ZapiInbound = {
  phone?: string;
  fromMe?: boolean;
  isGroup?: boolean;
  messageId?: string;
  senderName?: string;
  text?: { message?: string };
  // Alguns eventos vem em outros formatos — normalizamos
  message?: string;
  // Documento anexado (PDF de extrato bancario, principalmente)
  document?: {
    documentUrl?: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    caption?: string;
  };
  // Midia sem texto — cliente mandando audio/foto/video em vez de digitar.
  // Regina 04/08: o Leo mandou AUDIO e o webhook descartou em "no_content".
  audio?: { audioUrl?: string; mimeType?: string };
  image?: { imageUrl?: string; caption?: string };
  video?: { videoUrl?: string; caption?: string };
  sticker?: { stickerUrl?: string };
};

// Descreve a midia que veio sem texto, pra escalar pro admin com contexto.
function descreverMidia(body: ZapiInbound): { rotulo: string; url?: string } | null {
  if (body.audio?.audioUrl) return { rotulo: "áudio", url: body.audio.audioUrl };
  if (body.video?.videoUrl) return { rotulo: "vídeo", url: body.video.videoUrl };
  if (body.image?.imageUrl) return { rotulo: "imagem", url: body.image.imageUrl };
  if (body.sticker?.stickerUrl) return { rotulo: "figurinha", url: body.sticker.stickerUrl };
  return null;
}

export async function POST(req: NextRequest) {
  const rawText = await req.text();
  let body: ZapiInbound | null = null;
  try {
    body = JSON.parse(rawText) as ZapiInbound;
  } catch {
    body = null;
  }

  // Regina 14/07: log completo de TUDO que cai no endpoint pra debugar
  // porque webhook nao estava disparando. Grava em EventoGateway com
  // provider="ZAPI_INBOUND". Se algo cair aqui, aparece no DB.
  try {
    await prisma.eventoGateway.create({
      data: {
        provider: "ASAAS", // enum ainda nao tem ZAPI — usa ASAAS por enquanto pra nao migrar
        evento: "ZAPI_INBOUND_DEBUG",
        payload: rawText.slice(0, 3900),
      },
    });
  } catch {}

  if (!body) return NextResponse.json({ ok: true, skipped: "empty" });

  // 1) Ignora mensagens do proprio numero (loop)
  if (body.fromMe) return NextResponse.json({ ok: true, skipped: "fromMe" });

  const telefone = String(body.phone || "").replace(/\D/g, "");
  const mensagem = String(body.text?.message || body.message || "").trim();
  const messageId = String(body.messageId || "");
  const documento = body.document;

  // 2) Grupo: aceita SO se for o grupo de suporte (env SUPORTE_GROUP_ID).
  //    Outros grupos = ignorados. Regina 14/07: admins decidem no grupo.
  const SUPORTE_GROUP_ID = process.env.SUPORTE_GROUP_ID || "";
  if (body.isGroup) {
    if (!SUPORTE_GROUP_ID || telefone !== SUPORTE_GROUP_ID.replace(/\D/g, "")) {
      return NextResponse.json({ ok: true, skipped: "grupo_nao_suporte" });
    }
    // Msg de admin no grupo — interpreta decisao
    const nomeAutor = String(body.senderName || "admin");
    return processarMsgGrupoSuporte(mensagem, nomeAutor);
  }

  // Se veio um documento PDF anexado, roteia pra conciliacao (antes do fluxo de suporte).
  // Cliente pode mandar so o PDF, ou PDF + msg — em ambos os casos trata como extrato.
  if (!telefone) return NextResponse.json({ ok: true, skipped: "no_phone" });
  const ehPdf = !!documento?.documentUrl &&
    (documento.mimeType === "application/pdf" ||
      (documento.fileName ?? documento.title ?? "").toLowerCase().endsWith(".pdf"));
  if (ehPdf) {
    return processarExtratoBancarioViaWhatsApp({
      telefone,
      documentUrl: documento!.documentUrl!,
      nomeArquivo: documento!.fileName || documento!.title || "extrato-whatsapp.pdf",
      messageId,
    });
  }

  const midia = descreverMidia(body);
  if (!mensagem && !midia) return NextResponse.json({ ok: true, skipped: "no_content" });

  // Kill switch
  if (process.env.WHATSAPP_KILL_SWITCH === "1") {
    return NextResponse.json({ ok: true, skipped: "kill_switch" });
  }

  // 3) Localiza usuario pelo telefone. Casa por TODAS as variantes do numero:
  //    a Z-API entrega sem o nono digito ("556181505557") e o cadastro pode
  //    ter com o 9 e/ou sem o DDI. Comparar por igualdade exata fazia cliente
  //    real cair como desconhecido (Regina 04/08, caso do Leo).
  const usuario = await prisma.usuario.findFirst({
    where: { telefoneWhatsApp: { in: variantesTelefone(telefone) } },
    include: {
      conta: {
        include: {
          empresas: { orderBy: { criadoEm: "asc" }, take: 1, select: { razaoSocial: true } },
        },
      },
    },
  });

  // Numero que nao casou com nenhum cadastro — quase sempre LEAD vindo do site.
  //
  // Regina 28/08, caso do Patrique: ele escreveu 21h56 perguntando sobre nota
  // fiscal e ficou SEM NENHUMA resposta ate as 5h07 do dia seguinte. Nao foi
  // falha de entrega: o codigo so avisava os admins e, de proposito, nao
  // respondia a quem nao e cadastrado (receio de responder spam). Na pratica,
  // quem chega pelo site — justamente o lead que a gente paga anuncio pra
  // atrair — era o unico que ficava no vacuo.
  //
  // Regra da Regina: "nunca deixar o cliente sem retorno". Agora o lead recebe
  // acolhimento imediato com prazo, e a duvida de merito continua indo pro
  // grupo. O acolhimento NAO promete nada sobre o produto — quem responde o que
  // o sistema faz ou nao faz e gente, depois de olhar.
  if (!usuario) {
    const nome = String(body.senderName || "desconhecido");
    const conteudo = mensagem || `[enviou ${midia?.rotulo}]`;

    // Uma resposta automatica por numero a cada 24h. Sem isso, uma rajada de
    // spam viraria uma rajada de respostas nossas — e foi disparo em rajada que
    // derrubou o numero do WhatsApp em 12/08.
    const jaAcolhido = await leadJaAcolhidoHoje(telefone);
    if (!jaAcolhido) {
      try {
        await enviarTexto(
          telefone,
          `Olá! Aqui é o *CP System*. Recebemos a sua mensagem e ela já está com a nossa equipe.\n\n` +
            `Um especialista te responde em até *2 horas úteis* (segunda a sexta, das 9h às 18h).\n\n` +
            `Se quiser adiantar, me conta o que você precisa resolver — quanto mais detalhe, mais direta a resposta.`,
        );
        await registrarLeadAcolhido(telefone, nome, conteudo);
      } catch (err) {
        console.error("[zapi-inbound] falha ao acolher lead:", err);
      }
    }

    await notificarAdmin(
      `${nome} (LEAD — não cadastrado)`,
      telefone,
      conteudo,
      jaAcolhido
        ? `Lead já acolhido automaticamente nas últimas 24h. Continua aguardando resposta humana.`
        : `Lead novo vindo de fora da base. Já respondemos confirmando o recebimento e prometemos ` +
            `retorno em até 2 horas úteis — o relógio está correndo. Se for cliente com telefone ` +
            `errado no cadastro, vale corrigir o perfil dele.`,
    );
    return NextResponse.json({ ok: true, escalado: "lead_nao_cadastrado", telefone });
  }

  // 3b) Cliente mandou audio/foto/video sem texto. A IA so lê texto, entao
  //     confirma o recebimento na hora e escala pro humano ouvir/ver.
  //     Antes isso caia em "no_content" e o cliente ficava sem retorno.
  if (!mensagem && midia) {
    const chamadoMidia = await prisma.chamadoSuporte.create({
      data: {
        contaId: usuario.contaId,
        usuarioId: usuario.id,
        categoria: "OUTRO",
        titulo: `Cliente enviou ${midia.rotulo}`,
        descricao: `Cliente enviou ${midia.rotulo} sem texto.${midia.url ? ` Arquivo: ${midia.url}` : ""}`,
        status: "AGUARDANDO_ADMIN",
        iaAcaoResumo: `${midia.rotulo} não é lido pela IA — escalado pra humano`,
      },
    });
    await prisma.mensagemChamado.create({
      data: {
        chamadoId: chamadoMidia.id,
        autor: "CLIENTE",
        autorId: usuario.id,
        conteudo: `[${midia.rotulo}]${midia.url ? ` ${midia.url}` : ""}`,
      },
    });
    await enviarTexto(
      telefone,
      `Recebi seu ${midia.rotulo}, ${usuario.nome.split(" ")[0]}! Como não consigo processar ` +
        `${midia.rotulo} automaticamente, nossa equipe vai ${midia.rotulo === "áudio" ? "ouvir" : "ver"} ` +
        `e te responder ainda hoje.\n\nSe preferir, pode me mandar por escrito que já te ajudo na hora.`,
    ).catch((err) => console.error("[zapi-inbound] falha ao confirmar midia:", err));
    await notificarAdmin(
      usuario.nome,
      telefone,
      `[enviou ${midia.rotulo}]${midia.url ? ` — ${midia.url}` : ""}`,
      `Cliente mandou ${midia.rotulo}, que a IA não lê. Precisa de resposta humana.`,
      chamadoMidia.id,
    );
    return NextResponse.json({ ok: true, midia: midia.rotulo, escalado: true });
  }

  // 4) Idempotencia: ja processamos essa messageId?
  if (messageId) {
    const jaProcessado = await prisma.mensagemChamado.findFirst({
      where: { autor: "CLIENTE", conteudo: { contains: messageId.slice(0, 20) } },
      select: { id: true },
    });
    if (jaProcessado) return NextResponse.json({ ok: true, skipped: "duplicate" });
  }

  // 5) Reaproveita chamado ABERTO/IA_ANALISANDO/AGUARDANDO_ADMIN do
  //    ultimo dia — nova msg entra como MensagemChamado no mesmo chamado.
  //    Se nao houver aberto, cria novo.
  const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let chamado = await prisma.chamadoSuporte.findFirst({
    where: {
      usuarioId: usuario.id,
      status: { in: ["ABERTO", "IA_ANALISANDO", "AGUARDANDO_ADMIN"] },
      atualizadoEm: { gte: umDiaAtras },
    },
    orderBy: { atualizadoEm: "desc" },
  });
  if (!chamado) {
    chamado = await prisma.chamadoSuporte.create({
      data: {
        contaId: usuario.contaId,
        usuarioId: usuario.id,
        categoria: "OUTRO",
        titulo: mensagem.slice(0, 80),
        descricao: mensagem,
        status: "IA_ANALISANDO",
      },
    });
  } else {
    // Volta pra IA analisar de novo com o novo contexto
    await prisma.chamadoSuporte.update({ where: { id: chamado.id }, data: { status: "IA_ANALISANDO" } });
  }

  await prisma.mensagemChamado.create({
    data: { chamadoId: chamado.id, autor: "CLIENTE", autorId: usuario.id, conteudo: mensagem },
  });

  // 6) Chama IA
  let decisao;
  try {
    const historico = await historicoDoUsuario(usuario.id, 6);
    decisao = await decidirRespostaIA(mensagem, {
      usuarioId: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone,
      tipoConta: usuario.conta.tipo as "EMPRESA" | "ANALISTA",
      isSuperAdmin: usuario.superAdmin,
      statusAssinatura: usuario.conta.statusAssinatura,
      proximoVencimento: usuario.conta.proximoVencimento,
      empresaRazao: usuario.conta.empresas[0]?.razaoSocial,
      ultimasMensagens: historico,
    });
  } catch (err) {
    console.error("[zapi-inbound] IA falhou:", err);
    await prisma.chamadoSuporte.update({
      where: { id: chamado.id },
      data: {
        status: "AGUARDANDO_ADMIN",
        respostaIA: null,
        iaAcaoResumo: "IA falhou ao processar — escalado por default",
      },
    });
    await notificarAdmin(usuario.nome, telefone, mensagem, "IA falhou — precisa resposta manual", chamado.id);
    return NextResponse.json({ ok: true, ia: "erro", escalado: true });
  }

  // 7) Executa a decisao
  if (decisao.acao === "auto_responder") {
    // Envia via WA
    try {
      await enviarTexto(telefone, decisao.resposta);
    } catch (err) {
      console.error("[zapi-inbound] falha ao enviar auto-resposta:", err);
      // Se falhou envio, escala
      await prisma.chamadoSuporte.update({
        where: { id: chamado.id },
        data: { status: "AGUARDANDO_ADMIN", respostaIA: decisao.resposta, iaAcaoResumo: "IA respondeu mas envio WA falhou — escalado" },
      });
      await notificarAdmin(usuario.nome, telefone, mensagem, `IA gerou resposta mas envio falhou: ${err instanceof Error ? err.message : String(err)}`, chamado.id);
      return NextResponse.json({ ok: true, ia: "auto_responder_envio_falhou" });
    }
    await prisma.chamadoSuporte.update({
      where: { id: chamado.id },
      data: {
        categoria: (decisao.categoria as "DUVIDA_USO" | "AJUSTE_DADOS" | "CORRECAO_OPERACIONAL" | "BUG_SISTEMA" | "FEATURE_PEDIDO" | "OUTRO") || "OUTRO",
        titulo: decisao.resumo.slice(0, 80) || chamado.titulo,
        respostaIA: decisao.resposta,
        iaAgiu: true,
        iaAcaoResumo: `IA auto-respondeu (${decisao.categoria})`,
        status: "IA_RESOLVEU",
      },
    });
    await prisma.mensagemChamado.create({
      data: { chamadoId: chamado.id, autor: "IA", conteudo: decisao.resposta },
    });
    return NextResponse.json({ ok: true, ia: "auto_respondido" });
  }

  // Escalado
  await prisma.chamadoSuporte.update({
    where: { id: chamado.id },
    data: {
      categoria: (decisao.categoria as "DUVIDA_USO" | "AJUSTE_DADOS" | "CORRECAO_OPERACIONAL" | "BUG_SISTEMA" | "FEATURE_PEDIDO" | "OUTRO") || "OUTRO",
      titulo: decisao.resumoParaAdmin.slice(0, 80) || chamado.titulo,
      respostaIA: decisao.resposta,
      iaAcaoResumo: `IA escalou: ${decisao.motivo}`,
      status: "AGUARDANDO_ADMIN",
    },
  });
  await prisma.mensagemChamado.create({
    data: { chamadoId: chamado.id, autor: "IA", conteudo: `[ESCALADO PRA ADMIN] Resposta enviada ao cliente: "${decisao.resposta}"` },
  });

  // Envia resposta educada de "recebemos" pro cliente
  try {
    await enviarTexto(telefone, decisao.resposta);
  } catch (err) {
    console.error("[zapi-inbound] falha ao enviar msg de escalada:", err);
  }

  // Notifica admin
  await notificarAdmin(usuario.nome, telefone, mensagem, decisao.resumoParaAdmin, chamado.id);

  return NextResponse.json({ ok: true, ia: "escalado_admin" });
}

// ==================== LEADS (numero fora da base) ====================
//
// Lead nao tem Usuario nem Conta, e os dois sao obrigatorios em
// ChamadoSuporte. Em vez de criar tabela nova pra isso, o contato fica
// registrado como chamado da conta interna do CP System, com o telefone no
// titulo. Serve pra duas coisas: nao acolher o mesmo numero duas vezes no
// mesmo dia e deixar o historico do lead em algum lugar — hoje ele nao existe
// em lugar nenhum do sistema.

const TITULO_LEAD = "LEAD WhatsApp";

async function leadJaAcolhidoHoje(telefone: string): Promise<boolean> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const achado = await prisma.chamadoSuporte.findFirst({
    where: {
      titulo: { startsWith: `${TITULO_LEAD} ${telefone}` },
      criadoEm: { gte: desde },
    },
    select: { id: true },
  });
  return !!achado;
}

async function registrarLeadAcolhido(
  telefone: string,
  nome: string,
  conteudo: string,
): Promise<void> {
  const admin = await prisma.usuario.findFirst({
    where: { superAdmin: true },
    select: { id: true, contaId: true },
  });
  if (!admin) return; // sem conta interna nao ha onde registrar; o acolhimento ja foi enviado
  await prisma.chamadoSuporte.create({
    data: {
      contaId: admin.contaId,
      usuarioId: admin.id,
      categoria: "OUTRO",
      titulo: `${TITULO_LEAD} ${telefone} — ${nome}`.slice(0, 80),
      descricao: `Lead escreveu pelo WhatsApp:\n\n${conteudo}\n\nAcolhido automaticamente com promessa de retorno em até 2 horas úteis.`,
      status: "AGUARDANDO_ADMIN",
    },
  });
}

// Notifica admins do chamado escalado. Regina 14/07:
//   - Se SUPORTE_GROUP_ID setado: manda UMA msg pro grupo (todos admins veem)
//   - Se nao setado: fallback — msg individual pra cada super admin
async function notificarAdmin(nomeCliente: string, telefoneCliente: string, msgOriginal: string, resumoIA: string, chamadoId?: string): Promise<void> {
  const idCurtoStr = chamadoId ? idCurto(chamadoId) : "";
  const texto =
    `🚨 *Suporte precisa de decisão* ${idCurtoStr}\n\n` +
    `Cliente: *${nomeCliente}* (${telefoneCliente})\n\n` +
    `Msg do cliente:\n"${msgOriginal.slice(0, 300)}"\n\n` +
    `Resumo IA: ${resumoIA}\n\n` +
    `Respondam aqui no grupo com a decisão (a IA lê e executa) ou abram em cpsystem.app.br/admin/suporte`;

  const grupoId = process.env.SUPORTE_GROUP_ID || "";
  if (grupoId) {
    try {
      await enviarTexto(grupoId, texto);
      return;
    } catch (err) {
      console.error(`[zapi-inbound] falha ao postar no grupo suporte:`, err);
      // Cai no fallback de admins individuais abaixo
    }
  }

  const superAdmins = await prisma.usuario.findMany({
    where: { superAdmin: true, telefoneWhatsApp: { not: null }, optInWhatsApp: true },
    select: { telefoneWhatsApp: true, nome: true },
  });
  for (const admin of superAdmins) {
    if (!admin.telefoneWhatsApp) continue;
    try {
      await enviarTexto(admin.telefoneWhatsApp, texto);
    } catch (err) {
      console.error(`[zapi-inbound] falha ao notificar admin ${admin.nome}:`, err);
    }
  }
}

// Processa msg vinda do GRUPO DE SUPORTE — IA interpreta a decisao e executa.
async function processarMsgGrupoSuporte(mensagem: string, autorNome: string): Promise<NextResponse> {
  let decisao;
  try {
    decisao = await interpretarMsgAdmin(mensagem, autorNome);
  } catch (err) {
    console.error("[grupo-suporte] IA falhou:", err);
    return NextResponse.json({ ok: true, ia: "erro" });
  }

  if (decisao.acao === "ignorar" || decisao.acao === "nao_entendi") {
    return NextResponse.json({ ok: true, ia: decisao.acao, motivo: decisao.motivoInterno });
  }
  if (!decisao.chamadoId) {
    // IA nao identificou chamado — pergunta educadamente no grupo
    const grupoId = process.env.SUPORTE_GROUP_ID || "";
    if (grupoId) {
      await enviarTexto(grupoId, `⚠️ ${autorNome}, não consegui identificar de qual chamado você está falando. Referencie com o #ID (ex: #CMRJYP) ou me chame no /admin/suporte.`).catch(() => {});
    }
    return NextResponse.json({ ok: true, ia: "sem_chamado_identificado" });
  }

  const chamado = await prisma.chamadoSuporte.findUnique({
    where: { id: decisao.chamadoId },
    include: { usuario: { select: { telefoneWhatsApp: true, nome: true } } },
  });
  if (!chamado || !chamado.usuario.telefoneWhatsApp) {
    return NextResponse.json({ ok: true, erro: "chamado ou cliente sem telefone" });
  }

  const grupoId = process.env.SUPORTE_GROUP_ID || "";

  if (decisao.acao === "responder_cliente" || decisao.acao === "pedir_info") {
    if (!decisao.textoParaCliente) {
      if (grupoId) await enviarTexto(grupoId, `⚠️ ${autorNome}, entendi que você quer responder o cliente mas não achei o texto. Reescreva com o que enviar.`).catch(() => {});
      return NextResponse.json({ ok: true, ia: "sem_texto" });
    }
    try {
      await enviarTexto(chamado.usuario.telefoneWhatsApp, decisao.textoParaCliente);
    } catch (err) {
      if (grupoId) await enviarTexto(grupoId, `❌ Falha ao enviar msg pro cliente: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
      return NextResponse.json({ ok: true, erro: "envio falhou" });
    }
    await prisma.mensagemChamado.create({ data: { chamadoId: chamado.id, autor: "ADMIN", conteudo: decisao.textoParaCliente } });
    await prisma.chamadoSuporte.update({
      where: { id: chamado.id },
      data: {
        status: decisao.acao === "responder_cliente" ? "EM_IMPLEMENTACAO" : "AGUARDANDO_ADMIN",
        atualizadoEm: new Date(),
      },
    });
    if (grupoId) await enviarTexto(grupoId, `✅ Mensagem enviada pro ${chamado.usuario.nome} (${idCurto(chamado.id)}).`).catch(() => {});
    return NextResponse.json({ ok: true, ia: "respondido_cliente" });
  }

  if (decisao.acao === "resolver") {
    await prisma.chamadoSuporte.update({
      where: { id: chamado.id },
      data: { status: "RESOLVIDO_ADMIN", resolvidoEm: new Date() },
    });
    if (grupoId) await enviarTexto(grupoId, `✅ Chamado ${idCurto(chamado.id)} marcado como RESOLVIDO.`).catch(() => {});
    return NextResponse.json({ ok: true, ia: "resolvido" });
  }

  if (decisao.acao === "recusar") {
    await prisma.chamadoSuporte.update({
      where: { id: chamado.id },
      data: { status: "RECUSADO", resolvidoEm: new Date() },
    });
    if (grupoId) await enviarTexto(grupoId, `❌ Chamado ${idCurto(chamado.id)} marcado como RECUSADO.`).catch(() => {});
    return NextResponse.json({ ok: true, ia: "recusado" });
  }

  return NextResponse.json({ ok: true, ia: "acao_desconhecida" });
}

// GET pra healthcheck / verificacao manual
export async function GET() {
  return NextResponse.json({ msg: "Z-API inbound webhook OK. Use POST." });
}

// Cliente mandou PDF pelo WhatsApp — trata como upload de extrato bancario.
// Regina 21/07: "ele manda pelo proprio WhatsApp que voce esta notificando ele,
// voce extrai de la e ja joga no sistema". Feature so pra INTERMEDIARIO+PREMIUM.
async function processarExtratoBancarioViaWhatsApp(input: {
  telefone: string;
  documentUrl: string;
  nomeArquivo: string;
  messageId: string;
}): Promise<NextResponse> {
  const usuario = await prisma.usuario.findFirst({
    where: { telefoneWhatsApp: { in: variantesTelefone(input.telefone) } },
    include: { conta: { select: { id: true, plano: true, conciliacaoCortesiaAte: true } } },
  });
  if (!usuario) {
    // Mesmo motivo do fluxo de suporte: numero que nao casa vira alerta pro
    // admin, nunca silencio. Cliente mandando extrato nao pode ser engolido.
    await notificarAdmin(
      "desconhecido",
      input.telefone,
      `[enviou PDF: ${input.nomeArquivo}]`,
      "Mandou PDF (provável extrato) mas o número não bate com nenhum cadastro.",
    );
    return NextResponse.json({ ok: true, escalado: "usuario_nao_cadastrado", telefone: input.telefone });
  }

  if (!contaTemAcessoConciliacao(usuario.conta)) {
    await enviarTexto(
      input.telefone,
      `Recebi o PDF, mas a conciliação bancária automática está disponível a partir do plano *Intermediário*. Seu plano atual: *${usuario.conta.plano}*.\n\nVer planos: https://cpsystem.app.br/conta/assinatura`,
    ).catch(() => {});
    return NextResponse.json({ ok: true, skipped: "plano_sem_conciliacao" });
  }

  // Baixa o PDF do Z-API
  let pdfBuffer: Buffer;
  try {
    const resp = await fetch(input.documentUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} baixando PDF`);
    const arr = await resp.arrayBuffer();
    pdfBuffer = Buffer.from(arr);
  } catch (err) {
    console.error("[zapi-inbound] falha ao baixar PDF:", err);
    await enviarTexto(
      input.telefone,
      "Recebi o arquivo mas não consegui baixar pra processar. Pode tentar de novo? Se persistir, sobe pelo site: https://cpsystem.app.br/conciliacao",
    ).catch(() => {});
    return NextResponse.json({ ok: false, erro: "download_falhou" });
  }

  if (pdfBuffer.length > 20 * 1024 * 1024) {
    await enviarTexto(
      input.telefone,
      "Esse PDF é maior que 20 MB — não consigo processar por aqui. Sobe pelo site em https://cpsystem.app.br/conciliacao (aceita PDFs maiores).",
    ).catch(() => {});
    return NextResponse.json({ ok: false, erro: "pdf_grande" });
  }

  // Aviso imediato — extracao leva ~30s, evita cliente achar que sumiu
  await enviarTexto(
    input.telefone,
    `📄 Recebi o extrato! Estou processando com IA agora — em ~30 segundos te mando o resultado da conciliação.`,
  ).catch(() => {});

  const resultado = await processarExtrato({
    contaId: usuario.conta.id,
    fonte: "WHATSAPP_INBOUND",
    nomeArquivo: input.nomeArquivo,
    pdfBuffer,
  });

  if (!resultado.ok) {
    await enviarTexto(
      input.telefone,
      `❌ Não consegui processar esse PDF: ${resultado.erro}\n\nTenta subir pelo site: https://cpsystem.app.br/conciliacao`,
    ).catch(() => {});
    return NextResponse.json({ ok: false, erro: resultado.erro });
  }

  if (resultado.jaProcessado) {
    await enviarTexto(
      input.telefone,
      `Esse extrato já tinha sido processado antes. Ver resultado em https://cpsystem.app.br/conciliacao`,
    ).catch(() => {});
    return NextResponse.json({ ok: true, jaProcessado: true, extratoId: resultado.extratoId });
  }

  // Busca o resumo do extrato pra reportar ao cliente
  const extrato = await prisma.extrato.findUnique({
    where: { id: resultado.extratoId },
    select: {
      totalCreditos: true, totalTransacoes: true,
      qtdMatchAlto: true, qtdMatchMedio: true, qtdSemMatch: true,
    },
  });
  const totalCred = extrato?.totalCreditos ?? 0;
  const brl = totalCred.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  await enviarTexto(
    input.telefone,
    `✅ *Extrato processado!*\n\n` +
      `💰 Créditos: *${brl}* em ${extrato?.totalTransacoes ?? 0} transações\n` +
      `✓ Casados automaticamente: *${extrato?.qtdMatchAlto ?? 0}*\n` +
      `? Precisam sua confirmação: *${extrato?.qtdMatchMedio ?? 0}*\n` +
      `– Sem correspondência: *${extrato?.qtdSemMatch ?? 0}*\n\n` +
      `🔗 Ver detalhes: https://cpsystem.app.br/conciliacao`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, extratoId: resultado.extratoId });
}
