import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarTexto } from "@/lib/whatsapp";
import { decidirRespostaIA, historicoDoUsuario } from "@/lib/ia-suporte";

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
  const body = (await req.json().catch(() => null)) as ZapiInbound | null;
  if (!body) return NextResponse.json({ ok: true, skipped: "empty" });

  // 1) Ignora mensagens do proprio numero (loop)
  if (body.fromMe) return NextResponse.json({ ok: true, skipped: "fromMe" });
  // 2) Ignora grupos (nao atendemos grupos)
  if (body.isGroup) return NextResponse.json({ ok: true, skipped: "isGroup" });

  const telefone = String(body.phone || "").replace(/\D/g, "");
  const mensagem = String(body.text?.message || body.message || "").trim();
  const messageId = String(body.messageId || "");

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
    await notificarAdmin(usuario.nome, telefone, mensagem, "IA falhou — precisa resposta manual");
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
      await notificarAdmin(usuario.nome, telefone, mensagem, `IA gerou resposta mas envio falhou: ${err instanceof Error ? err.message : String(err)}`);
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
  await notificarAdmin(usuario.nome, telefone, mensagem, decisao.resumoParaAdmin);

  return NextResponse.json({ ok: true, ia: "escalado_admin" });
}

// Envia mensagem via WA pros super admins avisando de chamado escalado.
// So o Igor (5561981537113) por enquanto — Regina 21997209623 tb esta lista
// mas Regina disse pra usar o WA business como voz institucional.
async function notificarAdmin(nomeCliente: string, telefoneCliente: string, msgOriginal: string, resumoIA: string): Promise<void> {
  const superAdmins = await prisma.usuario.findMany({
    where: { superAdmin: true, telefoneWhatsApp: { not: null }, optInWhatsApp: true },
    select: { telefoneWhatsApp: true, nome: true },
  });
  const texto =
    `🚨 *Suporte precisa da sua atenção*\n\n` +
    `Cliente: *${nomeCliente}* (${telefoneCliente})\n\n` +
    `Msg do cliente:\n"${msgOriginal.slice(0, 300)}"\n\n` +
    `Resumo IA: ${resumoIA}\n\n` +
    `Abra em cpsystem.app.br/admin/suporte`;
  for (const admin of superAdmins) {
    if (!admin.telefoneWhatsApp) continue;
    try {
      await enviarTexto(admin.telefoneWhatsApp, texto);
    } catch (err) {
      console.error(`[zapi-inbound] falha ao notificar admin ${admin.nome}:`, err);
    }
  }
}

// GET pra healthcheck / verificacao manual
export async function GET() {
  return NextResponse.json({ msg: "Z-API inbound webhook OK. Use POST." });
}
