"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { enviarTesteManual, dispararNotificacao, formatarTelefone } from "@/lib/whatsapp";

type Result = { erro?: string; ok?: boolean; messageId?: string };

// Salva/atualiza o opt-in WhatsApp do usuario logado.
export async function salvarPreferenciaWhatsAppAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const telefoneRaw = String(formData.get("telefone") || "").trim();
  const optIn = String(formData.get("optIn") || "") === "1";

  if (optIn && !telefoneRaw) {
    return { erro: "Informe o telefone WhatsApp pra ativar as notificacoes." };
  }

  let telefone: string | null = null;
  if (telefoneRaw) {
    try {
      telefone = formatarTelefone(telefoneRaw);
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Telefone invalido." };
    }
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      telefoneWhatsApp: telefone,
      optInWhatsApp: optIn && !!telefone,
    },
  });

  revalidatePath("/conta/notificacoes");
  return { ok: true };
}

// SO super admin (Regina/Igor): dispara mensagem de teste pra um numero
// qualquer sem opt-in. Usado pra validar formato/entrega antes de liberar
// pros clientes.
export async function enviarTesteWhatsAppAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) {
    return { erro: "Apenas administradores da plataforma podem testar envios." };
  }

  const telefone = String(formData.get("telefone") || "").trim();
  const mensagem = String(formData.get("mensagem") || "").trim();
  if (!telefone || !mensagem) return { erro: "Telefone e mensagem obrigatorios." };

  try {
    const r = await enviarTesteManual(telefone, mensagem);
    return { ok: true, messageId: r.messageId };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha no envio." };
  }
}

// SO super admin: dispara notificacao "de verdade" pra si mesmo passando
// pelo pipeline (checa opt-in, grava historico, respeita idempotencia).
// Util pra ver end-to-end.
export async function enviarSelfNotificacaoAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) {
    return { erro: "Apenas administradores da plataforma podem testar envios." };
  }

  const mensagem = String(formData.get("mensagem") || "").trim();
  if (!mensagem) return { erro: "Mensagem obrigatoria." };

  const r = await dispararNotificacao({
    usuarioId: usuario.id,
    tipo: "TESTE_MANUAL",
    referenciaId: `manual-${Date.now()}`,
    mensagem,
  });
  if (!r.enviado) return { erro: `Nao enviado: ${r.motivo}` };
  return { ok: true, messageId: r.messageId };
}
