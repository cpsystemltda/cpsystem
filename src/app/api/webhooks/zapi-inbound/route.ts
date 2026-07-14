import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTexto } from "@/lib/whatsapp";
import { decidirRespostaIA, historicoDoUsuario } from "@/lib/ia-suporte";
import { interpretarMsgAdmin, idCurto } from "@/lib/ia-decisao-grupo";

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
};

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

  if (!telefone || !mensagem) return NextResponse.json({ ok: true, skipped: "no_content" });

  // Kill switch
  if (process.env.WHATSAPP_KILL_SWITCH === "1") {
    return NextResponse.json({ ok: true, skipped: "kill_switch" });
  }

  // 3) Localiza usuario pelo telefone. Se nao existir, ignora (numero de fora
  //    nao deve receber resposta automatica — pode ser spam).
  const usuario = await prisma.usuario.findFirst({
    where: { telefoneWhatsApp: telefone },
    include: {
      conta: {
        include: {
          empresas: { orderBy: { criadoEm: "asc" }, take: 1, select: { razaoSocial: true } },
        },
      },
    },
  });
  if (!usuario) return NextResponse.json({ ok: true, skipped: "usuario_nao_cadastrado", telefone });

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
