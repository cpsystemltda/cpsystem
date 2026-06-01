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
// Plano Básico: 2 perguntas grátis vitalícias (Regina 01/06). 3ª pergunta
// dispara paywall pro Premium. Premium e super admin sao ilimitados.
// NAO exportar — "use server" so aceita exports de async functions; o cliente
// tem a propria copia desta constante em FlutuanteIAsystem.tsx.
const LIMITE_PERGUNTAS_BASICO = 2;

export async function enviarMensagemIAsystemAction(
  novaMensagem: string,
): Promise<ResultadoIAsystem> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // IAsystem em Básico libera ate LIMITE_PERGUNTAS_BASICO consultas
  // vitalicias por usuario; a partir da proxima, exige upgrade. Premium
  // e super admin sao ilimitados (regras Regina 01/06).
  const ehPremium = usuario.superAdmin || usuario.conta.plano === "PREMIUM";
  if (!ehPremium) {
    const perguntasUsadas = await prisma.mensagemIAsystem.count({
      where: { usuarioId: usuario.id, role: "user" },
    });
    if (perguntasUsadas >= LIMITE_PERGUNTAS_BASICO) {
      return {
        ok: false,
        paywall: true,
        erro: `Você já usou suas ${LIMITE_PERGUNTAS_BASICO} perguntas grátis. Faça o upgrade pro Premium em /conta/assinatura para continuar consultando o IAsystem.`,
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
  // segurança é `usuarioId = usuario.id` direto da sessão.
  const historicoCru = await prisma.mensagemIAsystem.findMany({
    where: { usuarioId: usuario.id },
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

  // Limpa mensagens antigas se ultrapassou o limite
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
  // Conta perguntas usadas pra UI mostrar "X de N grátis" no Básico.
  const perguntasUsadasFinal = ehPremium
    ? undefined
    : await prisma.mensagemIAsystem.count({
        where: { usuarioId: usuario.id, role: "user" },
      });
  return {
    ok: true,
    resposta,
    perguntasUsadas: perguntasUsadasFinal,
    limiteGratis: ehPremium ? undefined : LIMITE_PERGUNTAS_BASICO,
  };
}

export async function carregarHistoricoIAsystem(): Promise<MensagemIAsystem[]> {
  const usuario = await exigirUsuario();
  // bloquearEspionagem NÃO se aplica aqui — leitura é OK em modo espionagem,
  // mas o histórico carregado é do super admin, não do cliente espionado
  // (já que enviarMensagemIAsystemAction bloqueia escrita em espionagem).
  const mensagens = await prisma.mensagemIAsystem.findMany({
    where: { usuarioId: usuario.id },
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

export async function limparHistoricoIAsystemAction(): Promise<{ ok: true }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  await prisma.mensagemIAsystem.deleteMany({ where: { usuarioId: usuario.id } });
  revalidatePath("/iasystem");
  return { ok: true };
}
