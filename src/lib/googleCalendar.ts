import "server-only";
import { prisma } from "@/lib/prisma";
import type { GoogleAccount } from "@/generated/prisma/client";
import { janelaExecucao } from "@/lib/prazoEntrega";

// Integracao Google Calendar (Igor 26/06).
// OAuth via "Aplicativo da Web" cadastrado no Google Cloud Console.
// Cada usuario conecta sua conta; sync best-effort (falhas nao bloqueiam
// criacao/edicao do empenho — log + console).

// Regina 23/07/2026: trocamos calendar.events (scope SENSITIVE, exige
// verificacao do Google que trava 6+ semanas) por calendar.app.created
// (NON-SENSITIVE — publica sem verificacao). O app cria/gerencia SEU proprio
// calendar secundario no Google Calendar do usuario ("CP System — Contratos
// e Vencimentos"), sem tocar na agenda principal.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

// Nome fixo do calendar secundario que o CP System cria em cada conta.
export const NOME_CALENDAR_CPS = "CP System — Contratos e Vencimentos";
const DESC_CALENDAR_CPS =
  "Eventos criados automaticamente pelo CP System: vencimentos de contratos, empenhos e prazos de entrega. Você pode ocultar esse calendário a qualquer momento.";

const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "https://cpsystem.app.br/api/google/callback";

export function getClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID nao configurado");
  return id;
}

function getClientSecret(): string {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_CLIENT_SECRET nao configurado");
  return s;
}

// URL de autorizacao que o usuario abre pra logar no Google e
// consentir os escopos. State carrega o usuarioId pra reconciliar no callback.
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // forca consent toda vez pra garantir refresh_token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Troca o `code` recebido no callback por access_token + refresh_token.
export async function trocarCodePorTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  idToken: string;
}> {
  const body = new URLSearchParams({
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Google token exchange falhou ${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await r.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
  };
  if (!data.refresh_token) {
    throw new Error(
      "Google nao retornou refresh_token. Revogue o acesso em https://myaccount.google.com/permissions e tente de novo.",
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    idToken: data.id_token ?? "",
  };
}

// Extrai email do id_token (JWT) sem validar assinatura — confiavel
// porque o token veio direto do Google em conexao HTTPS.
export function emailDoIdToken(idToken: string): string {
  if (!idToken) return "";
  try {
    const partes = idToken.split(".");
    if (partes.length < 2) return "";
    const payload = JSON.parse(Buffer.from(partes[1], "base64").toString("utf8"));
    return payload.email || "";
  } catch {
    return "";
  }
}

// Renova access_token usando refresh_token. Atualiza no banco.
async function renovarToken(contaGoogle: GoogleAccount): Promise<GoogleAccount> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: contaGoogle.refreshToken,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Renovar token Google falhou ${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await r.json()) as { access_token: string; expires_in: number };
  const novaConta = await prisma.googleAccount.update({
    where: { id: contaGoogle.id },
    data: {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
    },
  });
  return novaConta;
}

// Retorna access_token valido, renovando se faltar < 2min pra expirar.
export async function tokenValido(contaGoogle: GoogleAccount): Promise<string> {
  const agora = Date.now();
  const expira = contaGoogle.expiresAt.getTime();
  if (expira - agora > 120_000) return contaGoogle.accessToken;
  const renovada = await renovarToken(contaGoogle);
  return renovada.accessToken;
}

// Revoga refresh_token no Google e remove do banco. Idempotente.
export async function revogarConta(contaGoogle: GoogleAccount): Promise<void> {
  try {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(contaGoogle.refreshToken)}`,
      { method: "POST" },
    );
  } catch {
    // segue mesmo se revoke falhar — o importante e remover localmente
  }
  await prisma.googleAccount.delete({ where: { id: contaGoogle.id } });
}

// =================== Calendar API ===================

export type EventoCalendar = {
  // Titulo
  summary: string;
  description?: string;
  location?: string;
  // Periodo: se all-day, passa `date` (YYYY-MM-DD); se com horario, passa `dateTime` (ISO)
  inicio: { date?: string; dateTime?: string; timeZone?: string };
  fim: { date?: string; dateTime?: string; timeZone?: string };
};

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

// Cria o calendar dedicado do CP System na conta Google. Usa access_token
// direto (na primeira conexao ainda nao gravamos o GoogleAccount, entao
// nao temos o registro pra passar em callCalendar). Retorna o calendarId.
export async function criarCalendarCpSystem(accessToken: string): Promise<string> {
  const r = await fetch(`${CAL_BASE}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: NOME_CALENDAR_CPS,
      description: DESC_CALENDAR_CPS,
      timeZone: "America/Sao_Paulo",
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Criar calendar CP System falhou ${r.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await r.json()) as { id: string };
  return data.id;
}

async function callCalendar<T>(
  contaGoogle: GoogleAccount,
  path: string,
  init: RequestInit & { method: string },
): Promise<T> {
  const token = await tokenValido(contaGoogle);
  const r = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Google Calendar ${r.status}: ${txt.slice(0, 200)}`);
  }
  // 204 No Content em DELETE
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

function bodyDoEvento(ev: EventoCalendar): Record<string, unknown> {
  return {
    summary: ev.summary,
    description: ev.description,
    location: ev.location,
    start: ev.inicio,
    end: ev.fim,
  };
}

// Garante que o GoogleAccount tem um calendarId dedicado. Se nao tem,
// cria o calendar do CP System agora e persiste no DB. Retorna o
// GoogleAccount atualizado (com calendarId sempre preenchido).
async function garantirCalendarDedicado(contaGoogle: GoogleAccount): Promise<GoogleAccount> {
  if (contaGoogle.calendarId) return contaGoogle;
  const token = await tokenValido(contaGoogle);
  const calId = await criarCalendarCpSystem(token);
  return prisma.googleAccount.update({
    where: { id: contaGoogle.id },
    data: { calendarId: calId },
  });
}

export async function criarEvento(
  contaGoogle: GoogleAccount,
  ev: EventoCalendar,
): Promise<{ id: string; htmlLink?: string }> {
  const conta = await garantirCalendarDedicado(contaGoogle);
  const data = await callCalendar<{ id: string; htmlLink?: string }>(
    conta,
    `/calendars/${encodeURIComponent(conta.calendarId!)}/events`,
    { method: "POST", body: JSON.stringify(bodyDoEvento(ev)) },
  );
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function atualizarEvento(
  contaGoogle: GoogleAccount,
  eventId: string,
  ev: EventoCalendar,
): Promise<void> {
  const calId = contaGoogle.calendarId || "primary";
  await callCalendar(
    contaGoogle,
    `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PUT", body: JSON.stringify(bodyDoEvento(ev)) },
  );
}

export async function deletarEvento(
  contaGoogle: GoogleAccount,
  eventId: string,
): Promise<void> {
  const calId = contaGoogle.calendarId || "primary";
  try {
    await callCalendar(
      contaGoogle,
      `/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  } catch (e) {
    // 404/410 = evento ja sumiu do Google; idempotente
    const msg = e instanceof Error ? e.message : String(e);
    if (/40[49]/.test(msg)) return;
    throw e;
  }
}

// ============== Conversao Empenho -> EventoCalendar ==============

type EmpenhoSync = {
  id: string;
  numero: string;
  objeto: string;
  orgaoNome: string;
  orgaoEndereco: string | null;
  instrumento: string;
  janelaInicio: Date;
  janelaFim: Date;
  horaInicio: string | null;
  horaFim: string | null;
};

const LABEL_INSTRUMENTO: Record<string, string> = {
  NOTA_EMPENHO: "Nota de Empenho",
  CARTA_CONTRATO: "Carta-Contrato",
  AUTORIZACAO_COMPRA: "Autorização de Compra",
  AUTORIZACAO_ENTREGA: "Autorização de Entrega",
  ORDEM_SERVICO: "Ordem de Serviço",
};

// Constroi o payload do evento a partir dos dados do empenho.
// - Sem horario: evento ALL-DAY (date). Google usa start inclusivo, end exclusivo.
// - Com horario: evento timed (dateTime + TZ America/Sao_Paulo).
export function empenhoParaEvento(e: EmpenhoSync): EventoCalendar {
  const TZ = "America/Sao_Paulo";
  const label = LABEL_INSTRUMENTO[e.instrumento] || e.instrumento;
  const summary = `${label} ${e.numero} — ${e.orgaoNome}`;
  const description = e.objeto;
  const location = e.orgaoEndereco || undefined;

  function fmtData(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  if (e.horaInicio || e.horaFim) {
    const hi = e.horaInicio || "00:00";
    const hf = e.horaFim || e.horaInicio || "23:59";
    return {
      summary,
      description,
      location,
      inicio: { dateTime: `${fmtData(e.janelaInicio)}T${hi}:00`, timeZone: TZ },
      fim: { dateTime: `${fmtData(e.janelaFim)}T${hf}:00`, timeZone: TZ },
    };
  }

  // All-day: end exclusivo (precisa fim +1 dia)
  const fimExclusivo = new Date(e.janelaFim);
  fimExclusivo.setDate(fimExclusivo.getDate() + 1);
  return {
    summary,
    description,
    location,
    inicio: { date: fmtData(e.janelaInicio) },
    fim: { date: fmtData(fimExclusivo) },
  };
}

// =================== Sync alto nivel (chamado pelas server actions) ===================

// Sincroniza um empenho com o Google Calendar do usuario que o criou.
// Best-effort: se falhar (sem conta Google, sem datas, erro de rede),
// loga e segue. Nao deve bloquear criar/editar empenho.
//
// acao:
//  - "upsert": cria evento (se nao tem googleEventId) ou atualiza (se tem)
//  - "delete": remove do Google + zera googleEventId
//
// Se o empenho nao tem janela utilizavel (sem datas), pula upsert. Se ja
// tinha googleEventId, deleta no Google (porque o evento ficou orfao).
export async function sincronizarEmpenho(
  empenhoId: string,
  acao: "upsert" | "delete",
): Promise<void> {
  try {
    const empenho = await prisma.empenho.findUnique({
      where: { id: empenhoId },
      select: {
        id: true,
        numero: true,
        objeto: true,
        orgaoNome: true,
        orgaoEndereco: true,
        instrumento: true,
        criadoPorId: true,
        googleEventId: true,
        vigenciaFim: true,
        dataPrevistaExecucao: true,
        prazoEntregaModo: true,
        dataEntregaCerta: true,
        dataEntregaInicio: true,
        dataEntregaFim: true,
        dataPedidoRecebido: true,
        prazoEntregaDias: true,
        prazoEntregaUnidade: true,
        horaInicio: true,
        horaFim: true,
      },
    });
    if (!empenho || !empenho.criadoPorId) return;

    const contaGoogle = await prisma.googleAccount.findUnique({
      where: { usuarioId: empenho.criadoPorId },
    });
    if (!contaGoogle) return;

    // Acao DELETE: remove no Google e zera o id local
    if (acao === "delete") {
      if (empenho.googleEventId) {
        await deletarEvento(contaGoogle, empenho.googleEventId);
      }
      return;
    }

    // UPSERT
    const janela = janelaExecucao(empenho);
    const evento = empenhoParaEvento({
      id: empenho.id,
      numero: empenho.numero,
      objeto: empenho.objeto,
      orgaoNome: empenho.orgaoNome,
      orgaoEndereco: empenho.orgaoEndereco,
      instrumento: empenho.instrumento,
      janelaInicio: janela.inicio,
      janelaFim: janela.fim,
      horaInicio: empenho.horaInicio,
      horaFim: empenho.horaFim,
    });

    if (empenho.googleEventId) {
      await atualizarEvento(contaGoogle, empenho.googleEventId, evento);
    } else {
      const r = await criarEvento(contaGoogle, evento);
      await prisma.empenho.update({
        where: { id: empenho.id },
        data: { googleEventId: r.id },
      });
    }
  } catch (e) {
    // Best-effort — loga e segue. Empenho continua criado/editado normalmente.
    console.error("[Google Calendar sync] falhou pro empenho", empenhoId, e);
  }
}

// ============== SYNC de outras entidades (Regina 23/07) ==============
// Padrao unificado: sincronizarGenerico busca contaGoogle do criadoPorId,
// converte objeto em EventoCalendar all-day (vencimento = dia X), e chama
// criar/atualizar/deletar. Best-effort — nunca trava operacao principal.

async function contaGoogleDoCriador(criadoPorId: string | null): Promise<GoogleAccount | null> {
  if (!criadoPorId) return null;
  return prisma.googleAccount.findUnique({ where: { usuarioId: criadoPorId } });
}

function dataAllDayEvent(data: Date, summary: string, description: string, location?: string): EventoCalendar {
  function fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  // All-day: end exclusivo (fim +1 dia)
  const fim = new Date(data);
  fim.setDate(fim.getDate() + 1);
  return {
    summary,
    description,
    location,
    inicio: { date: fmt(data) },
    fim: { date: fmt(fim) },
  };
}

// -------- Ata --------
export async function sincronizarAta(ataId: string, acao: "upsert" | "delete"): Promise<void> {
  try {
    const ata = await prisma.ata.findUnique({
      where: { id: ataId },
      select: {
        id: true, numero: true, orgaoNome: true, orgaoEndereco: true, objeto: true,
        vigenciaFim: true, criadoPorId: true, googleEventId: true,
      },
    });
    if (!ata) return;
    const conta = await contaGoogleDoCriador(ata.criadoPorId);
    if (!conta) return;
    if (acao === "delete") {
      if (ata.googleEventId) await deletarEvento(conta, ata.googleEventId);
      return;
    }
    const evento = dataAllDayEvent(
      ata.vigenciaFim,
      `📄 Ata ${ata.numero} vence — ${ata.orgaoNome}`,
      `Vencimento da Ata de Registro de Preços nº ${ata.numero}\n\nObjeto: ${ata.objeto}`,
      ata.orgaoEndereco || undefined,
    );
    if (ata.googleEventId) {
      await atualizarEvento(conta, ata.googleEventId, evento);
    } else {
      const r = await criarEvento(conta, evento);
      await prisma.ata.update({ where: { id: ata.id }, data: { googleEventId: r.id } });
    }
  } catch (e) {
    console.error("[Google Calendar sync] falhou pra ata", ataId, e);
  }
}

// -------- Contrato --------
export async function sincronizarContrato(contratoId: string, acao: "upsert" | "delete"): Promise<void> {
  try {
    const contrato = await prisma.contrato.findUnique({
      where: { id: contratoId },
      select: {
        id: true, numero: true, orgaoNome: true, orgaoEndereco: true, objeto: true,
        vigenciaFim: true, criadoPorId: true, googleEventId: true,
      },
    });
    if (!contrato) return;
    const conta = await contaGoogleDoCriador(contrato.criadoPorId);
    if (!conta) return;
    if (acao === "delete") {
      if (contrato.googleEventId) await deletarEvento(conta, contrato.googleEventId);
      return;
    }
    const evento = dataAllDayEvent(
      contrato.vigenciaFim,
      `📋 Contrato ${contrato.numero} vence — ${contrato.orgaoNome}`,
      `Vencimento do Contrato nº ${contrato.numero}\n\nObjeto: ${contrato.objeto}`,
      contrato.orgaoEndereco || undefined,
    );
    if (contrato.googleEventId) {
      await atualizarEvento(conta, contrato.googleEventId, evento);
    } else {
      const r = await criarEvento(conta, evento);
      await prisma.contrato.update({ where: { id: contrato.id }, data: { googleEventId: r.id } });
    }
  } catch (e) {
    console.error("[Google Calendar sync] falhou pro contrato", contratoId, e);
  }
}

// -------- Garantia --------
// Garantia pertence a Contrato OU Empenho — usa criadoPorId do parent.
export async function sincronizarGarantia(garantiaId: string, acao: "upsert" | "delete"): Promise<void> {
  try {
    const g = await prisma.garantia.findUnique({
      where: { id: garantiaId },
      select: {
        id: true, modalidade: true, valor: true, dataFim: true, googleEventId: true,
        contrato: { select: { numero: true, orgaoNome: true, orgaoEndereco: true, criadoPorId: true } },
        empenho: { select: { numero: true, orgaoNome: true, orgaoEndereco: true, criadoPorId: true } },
      },
    });
    if (!g || !g.dataFim) return; // garantia sem data de vencimento nao vira evento
    const parent = g.contrato ?? g.empenho;
    if (!parent) return;
    const conta = await contaGoogleDoCriador(parent.criadoPorId);
    if (!conta) return;
    if (acao === "delete") {
      if (g.googleEventId) await deletarEvento(conta, g.googleEventId);
      return;
    }
    const valorFmt = g.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const evento = dataAllDayEvent(
      g.dataFim,
      `🛡️ Garantia ${g.modalidade} vence — ${parent.orgaoNome}`,
      `Vencimento de garantia (${g.modalidade}) — ${valorFmt}\n\nDocumento: ${parent.numero}`,
      parent.orgaoEndereco || undefined,
    );
    if (g.googleEventId) {
      await atualizarEvento(conta, g.googleEventId, evento);
    } else {
      const r = await criarEvento(conta, evento);
      await prisma.garantia.update({ where: { id: g.id }, data: { googleEventId: r.id } });
    }
  } catch (e) {
    console.error("[Google Calendar sync] falhou pra garantia", garantiaId, e);
  }
}
