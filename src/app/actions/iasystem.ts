"use server";

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { responderIAsystem, type MensagemIAsystem } from "@/lib/iasystem";

export type ResultadoIAsystem =
  | { ok: true; resposta: string }
  | { ok: false; erro: string };

export async function enviarMensagemIAsystemAction(
  historico: MensagemIAsystem[],
  novaMensagem: string,
): Promise<ResultadoIAsystem> {
  await exigirUsuario();
  await bloquearEspionagem();

  const pergunta = novaMensagem.trim();
  if (!pergunta) return { ok: false, erro: "Mensagem vazia." };
  if (pergunta.length > 4000) {
    return { ok: false, erro: "Mensagem muito longa (limite 4000 caracteres)." };
  }

  // Limita histórico a 30 últimas mensagens pra controlar custo de tokens
  const historicoLimitado = historico.slice(-30).filter((m) => {
    if (m.role !== "user" && m.role !== "assistant") return false;
    if (typeof m.content !== "string") return false;
    return m.content.trim().length > 0;
  });

  try {
    const resposta = await responderIAsystem(historicoLimitado, pergunta);
    return { ok: true, resposta };
  } catch (err) {
    console.error("[enviarMensagemIAsystemAction]", err);
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro ao consultar o IAsystem.",
    };
  }
}
