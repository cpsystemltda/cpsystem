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

// Envia mensagem de texto via Z-API. Retorna o messageId.
// Lanca erro se falhar — o caller decide se propaga ou log-e-segue.
export async function enviarTexto(
  telefone: string,
  mensagem: string,
): Promise<{ messageId: string }> {
  if (!CLIENT_TOKEN) throw new Error("ZAPI_CLIENT_TOKEN nao configurado");
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
export async function dispararNotificacao(opts: {
  usuarioId: string;
  tipo: TipoNotificacaoWhatsApp;
  referenciaId: string;
  mensagem: string;
}): Promise<{ enviado: boolean; motivo?: string; messageId?: string }> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: opts.usuarioId },
    select: { id: true, telefoneWhatsApp: true, optInWhatsApp: true },
  });
  if (!usuario) return { enviado: false, motivo: "usuario_nao_encontrado" };
  if (!usuario.optInWhatsApp) return { enviado: false, motivo: "sem_opt_in" };
  if (!usuario.telefoneWhatsApp) return { enviado: false, motivo: "sem_telefone" };

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
