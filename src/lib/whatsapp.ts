import "server-only";
import { prisma } from "@/lib/prisma";
import type { TipoNotificacaoWhatsApp } from "@/generated/prisma/client";

// Integracao WhatsApp via Z-API (Regina 02/07).
// Docs: https://developer.z-api.io/
// Endpoint base: https://api.z-api.io/instances/{instance}/token/{token}
// Autenticacao adicional: header "Client-Token" (Account Security Token)

const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const INSTANCE_TOKEN = process.env.ZAPI_INSTANCE_TOKEN;
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

function getBaseUrl(): string {
  if (!INSTANCE_ID || !INSTANCE_TOKEN) {
    throw new Error("ZAPI_INSTANCE_ID / ZAPI_INSTANCE_TOKEN nao configurados");
  }
  return `https://api.z-api.io/instances/${INSTANCE_ID}/token/${INSTANCE_TOKEN}`;
}

// Normaliza telefone BR pra E.164 sem "+": 55 + DDD + numero.
// Aceita entrada com/sem +, com/sem parenteses, com/sem espacos.
// Exemplos:
//   "21 99720-9623"     -> "5521997209623"
//   "(21) 99720-9623"   -> "5521997209623"
//   "+55 21 99720-9623" -> "5521997209623"
//   "5521997209623"     -> "5521997209623"
export function formatarTelefone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) throw new Error(`Telefone invalido: ${raw}`);
  // Ja tem 55 no comeco?
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // 10 digitos = fixo sem 9 (DDD + 8 digitos); 11 = movel (DDD + 9 digitos)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  throw new Error(`Telefone com formato inesperado: ${raw} (${digits.length} digitos)`);
}

type ZapiResponse = { messageId?: string; zaapId?: string; id?: string };
type ZapiStatus = { connected?: boolean; smartphoneConnected?: boolean; error?: string };

// Guarda-chuva CRITICO (Regina 07/07): a Z-API aceita send-text e retorna
// HTTP 200 + messageId MESMO com a instancia desconectada — a mensagem
// so vai pra fila. Ao reconectar, a Z-API retransmite TUDO da fila, muitas
// vezes com retry policy proprio — o resultado e spam pro cliente.
//
// Este helper CHECA /status antes de enviar. Se desconectado, lanca erro
// imediato — nao enfileira. Cache curto pra evitar consulta a cada msg
// dentro do mesmo batch (cron diario, por exemplo).
let statusCache: { conectado: boolean; consultadoEm: number } | null = null;
const STATUS_TTL_MS = 20 * 1000; // 20s

async function checarConexaoZapi(): Promise<void> {
  if (statusCache && Date.now() - statusCache.consultadoEm < STATUS_TTL_MS) {
    if (!statusCache.conectado) {
      throw new Error("Z-API desconectada — reconecte a instancia antes de disparar msgs.");
    }
    return;
  }
  if (!CLIENT_TOKEN) throw new Error("ZAPI_CLIENT_TOKEN nao configurado");
  const r = await fetch(`${getBaseUrl()}/status`, {
    headers: { "Client-Token": CLIENT_TOKEN },
  });
  if (!r.ok) {
    throw new Error(`Z-API /status ${r.status}`);
  }
  const s = (await r.json()) as ZapiStatus;
  const conectado = !!(s.connected && s.smartphoneConnected);
  statusCache = { conectado, consultadoEm: Date.now() };
  if (!conectado) {
    throw new Error(
      `Z-API desconectada (connected=${s.connected}, smartphoneConnected=${s.smartphoneConnected}). ` +
        `Reconecte a instancia via QR Code antes de disparar msgs.`,
    );
  }
}

// Invalida o cache — util quando o admin acabou de reconectar e quer
// forcar nova verificacao antes do proximo envio.
export function invalidarCacheStatusZapi(): void {
  statusCache = null;
}

// Envia mensagem de texto via Z-API. Retorna o messageId.
// Lanca erro se falhar — o caller decide se propaga ou log-e-segue.
// SEMPRE checa status de conexao antes (nao enfileira em instancia offline).
export async function enviarTexto(
  telefone: string,
  mensagem: string,
): Promise<{ messageId: string }> {
  if (!CLIENT_TOKEN) throw new Error("ZAPI_CLIENT_TOKEN nao configurado");
  await checarConexaoZapi();
  const phone = formatarTelefone(telefone);
  const r = await fetch(`${getBaseUrl()}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone, message: mensagem }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Z-API ${r.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await r.json()) as ZapiResponse;
  const messageId = data.messageId || data.zaapId || data.id || "";
  return { messageId };
}

// Dispara notificacao com idempotencia. Antes de enviar:
//   1. Confere se o usuario opt-in
//   2. Confere se telefone cadastrado
//   3. Confere se ja existe registro (usuarioId, tipo, referenciaId) —
//      se existir e status=ENVIADA, no-op; se FALHOU, retenta.
// Sempre grava em NotificacaoWhatsApp pra rastreio.
// referenciaId sempre string (nao-nulo) pra formar chave de idempotencia
// consistente. Callers usam ids naturais (empenhoId, cobrancaId) ou
// sentinelas semanticas (ex: "2026-27" pra semana 27 de 2026).
// KILL SWITCH universal — Regina 08/07/2026, apos flood do Leo.
// Setar env WHATSAPP_KILL_SWITCH=1 pra bloquear TODOS os disparos automaticos
// sem precisar de deploy. Ideal pra parar hemorragia em segundos: muda no
// Vercel e roda redeploy vazio, ou usa runtime env se preview enable.
function killSwitchAtivo(): boolean {
  return process.env.WHATSAPP_KILL_SWITCH === "1";
}

// CAP diario por usuario — Regina 08/07: no maximo 4 msgs por dia por
// destinatario, contando TUDO (cron + event-driven). Se atingiu 4, para.
export const LIMITE_MSGS_DIARIAS_POR_USUARIO = 4;

async function contarEnviadasHoje(usuarioId: string): Promise<number> {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  return prisma.notificacaoWhatsApp.count({
    where: {
      usuarioId,
      status: "ENVIADA",
      enviadaEm: { gte: inicioHoje },
    },
  });
}

export async function dispararNotificacao(opts: {
  usuarioId: string;
  tipo: TipoNotificacaoWhatsApp;
  referenciaId: string;
  mensagem: string;
  // Regina 22/07 — alertas de seguranca ignoram opt-in E cap diario.
  // Kill switch continua respeitado (emergencia geral).
  bypassCap?: boolean;
}): Promise<{ enviado: boolean; motivo?: string; messageId?: string }> {
  if (killSwitchAtivo()) return { enviado: false, motivo: "kill_switch" };
  const usuario = await prisma.usuario.findUnique({
    where: { id: opts.usuarioId },
    select: { id: true, telefoneWhatsApp: true, optInWhatsApp: true },
  });
  if (!usuario) return { enviado: false, motivo: "usuario_nao_encontrado" };
  if (!opts.bypassCap && !usuario.optInWhatsApp) return { enviado: false, motivo: "sem_opt_in" };
  if (!usuario.telefoneWhatsApp) return { enviado: false, motivo: "sem_telefone" };
  if (!opts.bypassCap) {
    // Cap diario — protege cliente de flood mesmo se tiver bug no cron.
    const enviadasHoje = await contarEnviadasHoje(opts.usuarioId);
    if (enviadasHoje >= LIMITE_MSGS_DIARIAS_POR_USUARIO) {
      return { enviado: false, motivo: "cap_diario_atingido" };
    }
  }

  // Idempotencia — se ja foi enviada com sucesso, no-op.
  const existente = await prisma.notificacaoWhatsApp.findUnique({
    where: {
      usuarioId_tipo_referenciaId: {
        usuarioId: opts.usuarioId,
        tipo: opts.tipo,
        referenciaId: opts.referenciaId,
      },
    },
    select: { id: true, status: true },
  });
  if (existente?.status === "ENVIADA") {
    return { enviado: false, motivo: "ja_enviada" };
  }

  // Upsert do registro (PENDENTE)
  const registro = await prisma.notificacaoWhatsApp.upsert({
    where: {
      usuarioId_tipo_referenciaId: {
        usuarioId: opts.usuarioId,
        tipo: opts.tipo,
        referenciaId: opts.referenciaId,
      },
    },
    create: {
      usuarioId: opts.usuarioId,
      tipo: opts.tipo,
      referenciaId: opts.referenciaId,
      telefone: formatarTelefone(usuario.telefoneWhatsApp),
      mensagem: opts.mensagem,
      status: "PENDENTE",
    },
    update: {
      mensagem: opts.mensagem,
      status: "PENDENTE",
      erro: null,
    },
  });

  try {
    const r = await enviarTexto(usuario.telefoneWhatsApp, opts.mensagem);
    await prisma.notificacaoWhatsApp.update({
      where: { id: registro.id },
      data: { status: "ENVIADA", enviadaEm: new Date(), erro: null },
    });
    return { enviado: true, messageId: r.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.notificacaoWhatsApp.update({
      where: { id: registro.id },
      data: { status: "FALHOU", erro: msg.slice(0, 500) },
    });
    return { enviado: false, motivo: "erro_zapi" };
  }
}

// Envio "cru" sem opt-in nem idempotencia — usado SOMENTE por acao
// admin de teste manual (super admin dispara e valida formato).
// NAO usar em fluxo automatico.
export async function enviarTesteManual(
  telefone: string,
  mensagem: string,
): Promise<{ messageId: string }> {
  return enviarTexto(telefone, mensagem);
}

// Envia um DOCUMENTO (PDF) via Z-API. A URL precisa ser publicamente
// acessivel — o Z-API baixa do URL e reenviar como documento nativo do
// WhatsApp (aparece como PDF anexado, nao link).
// Regina 07/07: NF deve chegar como PDF anexado, nao link do Asaas.
export async function enviarDocumentoPdf(
  telefone: string,
  pdfUrl: string,
  fileName: string,
  caption?: string,
): Promise<{ messageId: string }> {
  if (!CLIENT_TOKEN) throw new Error("ZAPI_CLIENT_TOKEN nao configurado");
  await checarConexaoZapi();
  const phone = formatarTelefone(telefone);
  // Endpoint Z-API: /send-document/{extension}
  const r = await fetch(`${getBaseUrl()}/send-document/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": CLIENT_TOKEN,
    },
    body: JSON.stringify({
      phone,
      document: pdfUrl,
      fileName,
      caption: caption ?? undefined,
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Z-API ${r.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await r.json()) as ZapiResponse;
  const messageId = data.messageId || data.zaapId || data.id || "";
  return { messageId };
}

// Variante de dispararNotificacao que envia PDF anexado em vez de texto.
// Usada pelo fluxo de NF (processarNfseGateway) — Regina 07/07.
// A `caption` vai como legenda embaixo do PDF no WhatsApp.
export async function dispararNotificacaoComPdf(opts: {
  usuarioId: string;
  tipo: TipoNotificacaoWhatsApp;
  referenciaId: string;
  pdfUrl: string;
  fileName: string;
  caption: string;
}): Promise<{ enviado: boolean; motivo?: string; messageId?: string }> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: opts.usuarioId },
    select: { id: true, telefoneWhatsApp: true, optInWhatsApp: true },
  });
  if (!usuario) return { enviado: false, motivo: "usuario_nao_encontrado" };
  if (!usuario.optInWhatsApp) return { enviado: false, motivo: "sem_opt_in" };
  if (!usuario.telefoneWhatsApp) return { enviado: false, motivo: "sem_telefone" };

  const existente = await prisma.notificacaoWhatsApp.findUnique({
    where: {
      usuarioId_tipo_referenciaId: {
        usuarioId: opts.usuarioId,
        tipo: opts.tipo,
        referenciaId: opts.referenciaId,
      },
    },
    select: { id: true, status: true },
  });
  if (existente?.status === "ENVIADA") {
    return { enviado: false, motivo: "ja_enviada" };
  }

  const registro = await prisma.notificacaoWhatsApp.upsert({
    where: {
      usuarioId_tipo_referenciaId: {
        usuarioId: opts.usuarioId,
        tipo: opts.tipo,
        referenciaId: opts.referenciaId,
      },
    },
    create: {
      usuarioId: opts.usuarioId,
      tipo: opts.tipo,
      referenciaId: opts.referenciaId,
      telefone: formatarTelefone(usuario.telefoneWhatsApp),
      mensagem: `[PDF] ${opts.fileName}\n\n${opts.caption}`.slice(0, 4000),
      status: "PENDENTE",
    },
    update: {
      mensagem: `[PDF] ${opts.fileName}\n\n${opts.caption}`.slice(0, 4000),
      status: "PENDENTE",
      erro: null,
    },
  });

  try {
    const r = await enviarDocumentoPdf(
      usuario.telefoneWhatsApp,
      opts.pdfUrl,
      opts.fileName,
      opts.caption,
    );
    await prisma.notificacaoWhatsApp.update({
      where: { id: registro.id },
      data: { status: "ENVIADA", enviadaEm: new Date(), erro: null },
    });
    return { enviado: true, messageId: r.messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.notificacaoWhatsApp.update({
      where: { id: registro.id },
      data: { status: "FALHOU", erro: msg.slice(0, 500) },
    });
    return { enviado: false, motivo: "erro_zapi" };
  }
}
