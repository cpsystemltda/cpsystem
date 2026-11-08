"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { invalidarCacheGateway } from "@/lib/gateway";
import { registrarAuditoria } from "@/lib/auditoria";

type Result = { erro?: string; ok?: boolean };

export async function salvarConfigGatewayAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  // Gateway de pagamento é da plataforma — só super admin (Regina/Igor)
  // configura. `perfil === "ADMIN"` é o perfil DENTRO da empresa-cliente,
  // não tem nada a ver com admin de plataforma.
  if (!usuario.superAdmin) return { erro: "Apenas administradores da plataforma." };

  const provider = String(formData.get("provider") || "DEMO") as "ASAAS" | "STRIPE" | "DEMO";
  const ambiente = String(formData.get("ambiente") || "sandbox");
  const apiKey = String(formData.get("apiKey") || "").trim();
  const webhookToken = String(formData.get("webhookToken") || "").trim();

  if (provider !== "DEMO" && !apiKey) {
    return { erro: "Chave de API obrigatória para este provedor." };
  }

  // ESP-007 RN01 (Igor 07/11/2026): segredo de integração nunca mais em
  // texto puro no banco — mesma cifra do token fiscal (AES-256-GCM).
  const { cifrar, segredoConfigurado } = await import("@/lib/segredos");
  if ((apiKey || webhookToken) && !segredoConfigurado()) {
    return { erro: "SEGREDO_CHAVE não configurada: o sistema se recusa a guardar a chave de API sem cifrar." };
  }
  await prisma.configuracaoGateway.upsert({
    where: { id: "singleton" },
    update: { provider, ambiente, apiKey: apiKey ? cifrar(apiKey) : null, webhookToken: webhookToken ? cifrar(webhookToken) : null, atualizadoPor: usuario.id },
    create: {
      id: "singleton",
      provider,
      ambiente,
      apiKey: apiKey ? cifrar(apiKey) : null,
      webhookToken: webhookToken ? cifrar(webhookToken) : null,
      atualizadoPor: usuario.id,
    },
  });

  invalidarCacheGateway();

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ConfiguracaoGateway",
    resumo: `Provider → ${provider} (${ambiente})`,
  });

  revalidatePath("/admin/gateway");
  return { ok: true };
}
