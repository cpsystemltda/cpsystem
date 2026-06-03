"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { responderIAsystem, type MensagemIAsystem } from "@/lib/iasystem";

export type ResultadoIAsystem =
  | {
      ok: true;
      resposta: string;
      perguntasUsadas?: number;
      limiteGratis?: number;
    }
  | { ok: false; erro: string; paywall?: boolean };

// Limite de mensagens enviadas pro Claude (controle de custo de tokens)
const LIMITE_CONTEXTO = 30;
// Limite de mensagens guardadas no banco por usuário (defesa contra abuso)
const LIMITE_PERSISTENCIA = 500;
// Plano Básico: 2 perguntas grátis POR DIA (Regina 02/06). Cota reseta
// a meia-noite do fuso do servidor. 3a pergunta no mesmo dia dispara
// paywall pro Premium. Premium e super admin sao ilimitados.
// NAO exportar — "use server" so aceita exports de async functions; o
// cliente tem a propria copia desta constante em FlutuanteIAsystem.tsx.
const LIMITE_PERGUNTAS_BASICO_POR_DIA = 2;

// Retorna o inicio do dia atual em UTC (00:00:00). Usado pra contar
// perguntas feitas "hoje". A cota reseta automaticamente na virada.
function inicioDoDia(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 0, 0, 0, 0));
}

// Conta perguntas (role=user) feitas HOJE pelo usuario. Inclui mensagens
// soft-deletadas — limpar historico nao reseta a cota (Regina 02/06:
// 'a cota volta no dia seguinte, nao quando limpa').
async function contarPerguntasHoje(usuarioId: string): Promise<number> {
  return prisma.mensagemIAsystem.count({
    where: {
      usuarioId,
      role: "user",
      criadoEm: { gte: inicioDoDia() },
    },
  });
}

export async function enviarMensagemIAsystemAction(
  novaMensagem: string,
): Promise<ResultadoIAsystem> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // Plano Basico: 2 perguntas/dia. Conta o que ja foi gasto hoje
  // (mesmo se o usuario limpou o historico). Premium/super admin
  // sao ilimitados.
  const ehPremium = usuario.superAdmin || usuario.conta.plano === "PREMIUM";
  if (!ehPremium) {
    const perguntasHoje = await contarPerguntasHoje(usuario.id);
    if (perguntasHoje >= LIMITE_PERGUNTAS_BASICO_POR_DIA) {
      return {
        ok: false,
        paywall: true,
        erro: `Você já usou suas ${LIMITE_PERGUNTAS_BASICO_POR_DIA} perguntas grátis de hoje. A cota reseta amanhã, ou faça upgrade pro Premium em /conta/assinatura para chat ilimitado.`,
      };
    }
  }

  const pergunta = novaMensagem.trim();
  if (!pergunta) return { ok: false, erro: "Mensagem vazia." };
  if (pergunta.length > 4000) {
    return { ok: false, erro: "Mensagem muito longa (limite 4000 caracteres)." };
  }

  // Carrega histórico do banco — isolado por usuarioId, ordenado por data.
  // Nunca compartilha entre usuários (mesmo no mesmo navegador): a chave de
  // segurança é `usuarioId = usuario.id` direto da sessão. Inclui mensagens
  // visiveis (nao soft-deletadas) pra alimentar o contexto do Claude.
  const historicoCru = await prisma.mensagemIAsystem.findMany({
    where: { usuarioId: usuario.id, deletadaEm: null },
    orderBy: { criadoEm: "asc" },
    take: LIMITE_CONTEXTO,
  });
  const historico: MensagemIAsystem[] = historicoCru
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Persiste a pergunta do usuário ANTES de chamar a IA — assim, se Claude
  // falhar, a pergunta fica salva e o usuário pode tentar novamente.
  await prisma.mensagemIAsystem.create({
    data: { usuarioId: usuario.id, role: "user", content: pergunta },
  });

  let resposta: string;
  try {
    resposta = await responderIAsystem(historico, pergunta, usuario.nome);
  } catch (err) {
    console.error("[enviarMensagemIAsystemAction]", err);
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro ao consultar o IAsystem.",
    };
  }

  // Persiste a resposta do assistente
  await prisma.mensagemIAsystem.create({
    data: { usuarioId: usuario.id, role: "assistant", content: resposta },
  });

  // Limpa mensagens antigas se ultrapassou o limite (hard delete eh OK
  // aqui: sao mensagens MUITO antigas, fora de qualquer cota diaria).
  const total = await prisma.mensagemIAsystem.count({ where: { usuarioId: usuario.id } });
  if (total > LIMITE_PERSISTENCIA) {
    const excesso = total - LIMITE_PERSISTENCIA;
    const maisAntigas = await prisma.mensagemIAsystem.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { criadoEm: "asc" },
      take: excesso,
      select: { id: true },
    });
    await prisma.mensagemIAsystem.deleteMany({
      where: { id: { in: maisAntigas.map((m) => m.id) } },
    });
  }

  revalidatePath("/iasystem");
  // Conta perguntas usadas HOJE pra UI mostrar "X de N grátis" no Básico.
  const perguntasUsadasFinal = ehPremium ? undefined : await contarPerguntasHoje(usuario.id);
  return {
    ok: true,
    resposta,
    perguntasUsadas: perguntasUsadasFinal,
    limiteGratis: ehPremium ? undefined : LIMITE_PERGUNTAS_BASICO_POR_DIA,
  };
}

export async function carregarHistoricoIAsystem(): Promise<MensagemIAsystem[]> {
  const usuario = await exigirUsuario();
  // bloquearEspionagem NÃO se aplica aqui — leitura é OK em modo espionagem,
  // mas o histórico carregado é do super admin, não do cliente espionado
  // (já que enviarMensagemIAsystemAction bloqueia escrita em espionagem).
  // Filtra deletadaEm null — soft-deletadas existem so pra cota diaria,
  // nao aparecem no chat.
  const mensagens = await prisma.mensagemIAsystem.findMany({
    where: { usuarioId: usuario.id, deletadaEm: null },
    orderBy: { criadoEm: "asc" },
    take: 100, // mostra até 100 mais recentes na UI
  });
  return mensagens
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

// Retorna a contagem de perguntas usadas HOJE. UI carrega isso no abrir
// pra mostrar 'X de 2 grátis usadas' corretamente apos o usuario limpar
// historico (limpar nao reseta a cota).
export async function carregarPerguntasUsadasHojeAction(): Promise<{
  perguntasUsadas: number;
  limiteGratis: number;
}> {
  const usuario = await exigirUsuario();
  return {
    perguntasUsadas: await contarPerguntasHoje(usuario.id),
    limiteGratis: LIMITE_PERGUNTAS_BASICO_POR_DIA,
  };
}

export async function limparHistoricoIAsystemAction(): Promise<{ ok: true }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  // Soft delete — preserva o registro das perguntas pra a cota diaria
  // continuar valendo. As mensagens somem do chat mas continuam contando
  // pro limite de hoje (Regina 02/06).
  await prisma.mensagemIAsystem.updateMany({
    where: { usuarioId: usuario.id, deletadaEm: null },
    data: { deletadaEm: new Date() },
  });
  revalidatePath("/iasystem");
  return { ok: true };
}
