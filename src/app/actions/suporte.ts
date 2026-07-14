"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { enviarTexto } from "@/lib/whatsapp";

export type SuporteResult = { erro?: string; ok?: boolean };

// Admin responde um chamado — envia msg pro cliente via WA + marca status.
export async function responderChamadoAction(
  _prev: SuporteResult | null,
  formData: FormData,
): Promise<SuporteResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Somente super admin." };

  const chamadoId = String(formData.get("chamadoId") || "");
  const resposta = String(formData.get("resposta") || "").trim();
  const acao = String(formData.get("acao") || "responder") as "responder" | "resolver" | "recusar";
  if (!chamadoId) return { erro: "chamadoId obrigatório." };
  if (acao !== "recusar" && !resposta) return { erro: "Escreva uma resposta." };

  const chamado = await prisma.chamadoSuporte.findUnique({
    where: { id: chamadoId },
    include: { usuario: { select: { telefoneWhatsApp: true, nome: true, id: true } } },
  });
  if (!chamado) return { erro: "Chamado não encontrado." };
  if (!chamado.usuario.telefoneWhatsApp) return { erro: "Cliente sem telefone cadastrado." };

  // Envia resposta via WA (se acao=responder ou resolver)
  if (acao !== "recusar") {
    try {
      await enviarTexto(chamado.usuario.telefoneWhatsApp, resposta);
    } catch (err) {
      return { erro: `Falha ao enviar WA: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // Grava msg + atualiza status
  if (resposta) {
    await prisma.mensagemChamado.create({
      data: { chamadoId, autor: "ADMIN", autorId: usuario.id, conteudo: resposta },
    });
  }
  await prisma.chamadoSuporte.update({
    where: { id: chamadoId },
    data: {
      status: acao === "resolver" ? "RESOLVIDO_ADMIN" : acao === "recusar" ? "RECUSADO" : "EM_IMPLEMENTACAO",
      resolvidoPorId: acao === "responder" ? null : usuario.id,
      resolvidoEm: acao === "responder" ? null : new Date(),
    },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ChamadoSuporte",
    recursoId: chamadoId,
    resumo: `Admin ${acao} chamado — cliente: ${chamado.usuario.nome}`,
  });

  revalidatePath("/admin/suporte");
  return { ok: true };
}
