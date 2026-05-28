"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { responderIAsystem, type MensagemIAsystem } from "@/lib/iasystem";

export type ResultadoIAsystem =
  | { ok: true; resposta: string }
  | { ok: false; erro: string };

// Limite de mensagens enviadas pro Claude (controle de custo de tokens)
const LIMITE_CONTEXTO = 30;
// Limite de mensagens guardadas no banco por usuário (defesa contra abuso)
const LIMITE_PERSISTENCIA = 500;

export async function enviarMensagemIAsystemAction(
  novaMensagem: string,
): Promise<ResultadoIAsystem> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // IAsystem é feature Premium (decisão Regina 28/05). Guard server-side
  // de defesa em profundidade — UI já bloqueia, mas se alguém burlar via
  // POST direto, ainda barra aqui. Super admin (Regina/Igor) tem acesso
  // pra testar e demonstrar a feature.
  if (!usuario.superAdmin && usuario.conta.plano !== "PREMIUM") {
    return {
      ok: false,
      erro: "O IAsystem é uma feature exclusiva do plano Premium. Faça o upgrade em /conta/assinatura.",
    };
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
  return { ok: true, resposta };
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
