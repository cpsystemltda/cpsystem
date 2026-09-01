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
  // ID de GRUPO do WhatsApp nao e telefone: vem como "1203634...-group" (ou so
  // o numerao de 18 digitos). Passa direto, sem formatar.
  //
  // Regina 28/08: era exatamente isto que fazia TODO alerta pro grupo de
  // suporte falhar — a validacao tratava o ID como telefone, estourava
  // "formato inesperado (18 digitos)" e o alerta morria no log. Foi por isso
  // que ninguem soube do lead que chegou pelo site.
  // Corte em 17 digitos de proposito: E.164 permite ate 15 digitos num telefone
  // internacional, e ID de grupo do WhatsApp tem 18. Nao dá pra confundir os
  // dois — evita transformar um telefone estrangeiro em "grupo" por engano.
  const cru = raw.trim();
  const soDigitos = cru.replace(/\D/g, "");
  if (cru.endsWith("-group") || soDigitos.length >= 17) {
    return cru.endsWith("-group") ? cru : `${soDigitos}-group`;
  }

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

// Gera TODAS as variantes plausiveis de um numero BR pra casar cadastro x Z-API.
// Regina 04/08: o Leo mandou msg e o sistema ignorou em silencio porque ele esta
// cadastrado como "5561981505557" (13 digitos, com o 9) e a Z-API entrega o
// mesmo numero como "556181505557" (12 digitos, sem o 9). O lookup era
// igualdade exata — nao batia, caia em "usuario_nao_cadastrado" e morria ali.
// O cadastro da Regina tem 11 digitos (sem o 55), entao tambem nunca bateria.
//
// Cobre as 4 formas em circulacao: nacional com/sem o nono digito, cada uma
// com e sem o DDI 55.
export function variantesTelefone(raw: string): string[] {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return digits ? [digits] : [];

  // Descasca o DDI pra trabalhar sempre com DDD + numero
  const nacional =
    digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;
  if (nacional.length !== 10 && nacional.length !== 11) return [digits];

  const ddd = nacional.slice(0, 2);
  const numero = nacional.slice(2);
  // O par: com o nono digito e sem ele
  const comNove = numero.length === 8 ? `9${numero}` : numero;
  const semNove = numero.length === 9 && numero.startsWith("9") ? numero.slice(1) : numero;

  const formas = new Set<string>();
  for (const n of [comNove, semNove]) {
    formas.add(`${ddd}${n}`);
    formas.add(`55${ddd}${n}`);
  }
  formas.add(digits); // o formato cru, por garantia
  return [...formas];
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

/**
 * Destino de um envio: telefone OU id de grupo do WhatsApp.
 *
 * Regina 28/08: TODO alerta pro grupo de suporte falhava porque o id do grupo
 * ("1203634…-group", 18 dígitos) passava por `formatarTelefone`, que o tratava
 * como telefone e estourava "formato inesperado". O alerta morria no log — foi
 * por isso que ninguém soube do lead que chegou pelo site.
 *
 * A separação é de propósito: `formatarTelefone` continua ESTRITO porque é ele
 * que valida telefone digitado por gente no cadastro. Se aceitasse id de grupo,
 * um número digitado errado (repetido, por exemplo) entraria como válido e o
 * cliente ficaria com telefone impossível de receber mensagem.
 *
 * Corte em 17 dígitos: E.164 vai até 15 num telefone internacional e id de grupo
 * tem 18 — não há como confundir os dois.
 */
export function formatarDestino(raw: string): string {
  const cru = raw.trim();
  const soDigitos = cru.replace(/\D/g, "");
  if (cru.endsWith("-group")) return cru;
  if (soDigitos.length >= 17) return `${soDigitos}-group`;
  return formatarTelefone(cru);
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
  const phone = formatarDestino(telefone);
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

/**
 * Ate quantos dias apos o cadastro a rede de seguranca das boas-vindas vale.
 * Depois disso a conta ja e cliente estabelecido, e o padrao volta a ser a
 * mensagem normal do sistema.
 */
const JANELA_BOAS_VINDAS_DIAS = 7;

/**
 * Garante que a conta do destinatario ja foi recebida antes do primeiro aviso.
 *
 * Best-effort de proposito: se as boas-vindas falharem, a notificacao original
 * segue mesmo assim — segurar um aviso de prazo por causa de cortesia seria
 * trocar um problema de etiqueta por um de prejuizo.
 *
 * O import e dinamico porque boasVindas.ts importa este modulo; estatico daria
 * ciclo. darBoasVindas dispara com tipo BOAS_VINDAS, que o guard ignora — nao
 * ha recursao.
 */
async function garantirBoasVindas(usuarioId: string): Promise<void> {
  try {
    const u = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { contaId: true, superAdmin: true, conta: { select: { criadoEm: true } } },
    });
    // Conta interna do CP System opera o sistema, nao e cliente dele.
    if (!u || u.superAdmin || !u.conta) return;

    // SO pra cadastro novo — Regina 31/08: "essa regra de boas-vindas antes de
    // notificacao so e valida pra novos cadastros, nunca pra cadastros que ja
    // estao um tempo na plataforma, que ai fica o padrao de mensagem normal
    // como ja esta hoje". Mandar "bem-vindo" pra quem ja usa o sistema nao
    // acolhe ninguem: soa como se a gente nao soubesse quem e o cliente.
    //
    // A idade da conta sozinha NAO serve de criterio, e isso custou caro:
    // em 01/09 o Marcos (cadastro 28/08) e a Michelly (25/08) receberam
    // "Bem-vindo ao CP System" no meio da rotina de ativacao. Os dois estavam
    // dentro da janela de dias, mas os dois ja vinham recebendo notificacao
    // havia dias — de novo eles nao tinham nada.
    //
    // O criterio certo e este: a rede de seguranca so vale pra quem NUNCA
    // recebeu nada nossa. E exatamente o buraco que ela existe pra tapar —
    // cadastro cujo acolhimento nao disparou — e exclui, por construcao, quem
    // ja esta no fluxo.
    const jaRecebeuAlgo = await prisma.notificacaoWhatsApp.count({
      where: { usuarioId, status: "ENVIADA" },
    });
    if (jaRecebeuAlgo > 0) return;

    const diasDeConta = (Date.now() - u.conta.criadoEm.getTime()) / 86_400_000;
    if (diasDeConta > JANELA_BOAS_VINDAS_DIAS) return;

    const { darBoasVindas } = await import("@/lib/boasVindas");
    await darBoasVindas(u.contaId);
  } catch (e) {
    console.error("[whatsapp] boas-vindas previas falharam:", e);
  }
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

  // Boas-vindas antes de qualquer aviso automatico — Regina 31/08:
  // "todo cliente, antes mesmo de receber notificacao, recebe mensagem de
  // boas-vindas". A Michelly e o Marcos conheceram o CP System por um aviso de
  // documento: o primeiro contato da empresa com eles foi um robo falando de
  // prazo, sem ninguem ter dado bom dia. A rotina de boas-vindas existe desde
  // 28/08, mas nada impedia que uma notificacao chegasse primeiro — quem se
  // cadastrou antes dela, ou por um caminho que nao a chamava, seguia
  // descoberto. Aqui a ordem passa a ser garantida no unico ponto por onde
  // todo disparo automatico passa.
  //
  // Alerta de seguranca (bypassCap) fica de fora de proposito: login suspeito
  // nao espera cortesia.
  if (opts.tipo !== "BOAS_VINDAS" && !opts.bypassCap) {
    await garantirBoasVindas(opts.usuarioId);
  }

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
  const phone = formatarDestino(telefone);
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

/**
 * Envia um video pelo WhatsApp com legenda (Regina 14/08).
 *
 * Usado na prospeccao: o tour institucional vai como ARQUIVO, nao como link —
 * link exige um clique a mais e leva a pessoa pra fora da conversa, enquanto o
 * video toca ali mesmo. A legenda viaja junto, entao a mensagem chega inteira.
 *
 * `videoUrl` precisa ser publica: a Z-API baixa o arquivo pelo endereco.
 */
/**
 * Encaminha um audio (o que o cliente mandou) pra um destino — na pratica, o
 * grupo de suporte.
 *
 * Regina 31/08: "quando um cliente manda audio e voce nao conseguir ouvir,
 * alem de comunicar no suporte (...) encaminha o audio pra que a gente possa
 * ouvir la no grupo de suporte. Dessa vez eu ja encaminhei de forma manual".
 * O alerta ja levava a URL do arquivo, mas link nao se escuta na conversa: ou
 * alguem abre o navegador, ou o cliente espera. Agora o audio chega tocavel
 * dentro do grupo, junto do alerta.
 *
 * Tenta /send-audio e, se a instancia recusar, reenvia como documento — o
 * mesmo caminho que ja entrega PDF e video nesta instancia (ver enviarVideo).
 */
export async function enviarAudio(
  telefone: string,
  audioUrl: string,
): Promise<{ messageId: string }> {
  if (!CLIENT_TOKEN) throw new Error("ZAPI_CLIENT_TOKEN nao configurado");
  await checarConexaoZapi();
  const phone = formatarDestino(telefone);
  const headers = {
    "Content-Type": "application/json",
    "Client-Token": CLIENT_TOKEN,
  };

  const r = await fetch(`${getBaseUrl()}/send-audio`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, audio: audioUrl }),
  });
  if (r.ok) {
    const data = (await r.json()) as ZapiResponse;
    return { messageId: data.messageId || data.zaapId || data.id || "" };
  }

  const motivo = (await r.text()).slice(0, 200);
  console.warn(`[whatsapp] /send-audio recusou (${r.status}: ${motivo}) — tentando como documento`);

  const alt = await fetch(`${getBaseUrl()}/send-document/ogg`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      phone,
      document: audioUrl,
      fileName: "audio-do-cliente.ogg",
    }),
  });
  if (!alt.ok) {
    const txt = await alt.text();
    throw new Error(`Z-API send-audio ${r.status} e send-document ${alt.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await alt.json()) as ZapiResponse;
  return { messageId: data.messageId || data.zaapId || data.id || "" };
}

export async function enviarVideo(
  telefone: string,
  videoUrl: string,
  caption?: string,
): Promise<{ messageId: string }> {
  if (!CLIENT_TOKEN) throw new Error("ZAPI_CLIENT_TOKEN nao configurado");
  await checarConexaoZapi();
  const phone = formatarDestino(telefone);
  // Regina 14/08: /send-video devolvia messageId mas a mensagem nunca chegava.
  // /send-document/mp4 e o mesmo caminho que ja entrega os PDFs de NF e o
  // contrato do analista nesta instancia, entao e o que se usa aqui. Chega como
  // arquivo de video anexado — reproduzivel dentro da conversa.
  const r = await fetch(`${getBaseUrl()}/send-document/mp4`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": CLIENT_TOKEN,
    },
    body: JSON.stringify({
      phone,
      document: videoUrl,
      fileName: "CP System - tour de 2 minutos.mp4",
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
