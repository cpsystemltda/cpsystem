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
// Regina 18/08: eram 2 por DIA, e como a cota voltava toda manha o cliente do
// Basico nunca sentia falta — a degustacao virou plano gratuito disfarcado.
// Agora sao 3 no TOTAL da conta: o cliente sente o gostinho, entende o valor e
// bate na trava de vez, que e o momento em que o upgrade faz sentido pra ele.
const PERGUNTAS_DEGUSTACAO = 3;

// Conta TODAS as perguntas ja feitas pela conta, desde sempre. Inclui as
// soft-deletadas — limpar o historico nao devolve cota (Regina 02/06).
// Conta por CONTA, nao por usuario: senao bastava criar outro login da mesma
// empresa pra ganhar mais tres.
async function contarPerguntasDaConta(contaId: string): Promise<number> {
  return prisma.mensagemIAsystem.count({
    where: {
      role: "user",
      usuario: { contaId },
    },
  });
}

export async function enviarMensagemIAsystemAction(
  novaMensagem: string,
): Promise<ResultadoIAsystem> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // Premium e ilimitado. Intermediario tem cota mensal propria (10/mes) e
  // Basico ganha so a degustacao de 3 perguntas na vida da conta.
  const plano = usuario.conta.plano;
  const ilimitado = usuario.superAdmin || plano === "PREMIUM";
  if (!ilimitado) {
    const jaUsadas = await contarPerguntasDaConta(usuario.contaId);
    if (jaUsadas >= PERGUNTAS_DEGUSTACAO) {
      return {
        ok: false,
        paywall: true,
        erro:
          `Você usou as suas ${PERGUNTAS_DEGUSTACAO} perguntas de demonstração do IAsystem. ` +
          `Para continuar tirando dúvidas sobre execução contratual, o plano Intermediário ` +
          `inclui 10 perguntas por mês e o Premium é ilimitado — veja em /conta/assinatura.`,
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
  // Quantas das perguntas de demonstração já foram gastas, pra UI mostrar
  // "X de 3" enquanto ainda há saldo.
  const perguntasUsadasFinal = ilimitado ? undefined : await contarPerguntasDaConta(usuario.contaId);
  return {
    ok: true,
    resposta,
    perguntasUsadas: perguntasUsadasFinal,
    limiteGratis: ilimitado ? undefined : PERGUNTAS_DEGUSTACAO,
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
    perguntasUsadas: await contarPerguntasDaConta(usuario.contaId),
    limiteGratis: PERGUNTAS_DEGUSTACAO,
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
