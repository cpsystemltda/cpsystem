"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { invalidarCacheGateway } from "@/lib/gateway";
import { registrarAuditoria } from "@/lib/auditoria";

type Result = { erro?: string; ok?: boolean };

export async function salvarConfigGatewayAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins." };

  const provider = String(formData.get("provider") || "DEMO") as "ASAAS" | "STRIPE" | "DEMO";
  const ambiente = String(formData.get("ambiente") || "sandbox");
  const apiKey = String(formData.get("apiKey") || "").trim();
  const webhookToken = String(formData.get("webhookToken") || "").trim();

  if (provider !== "DEMO" && !apiKey) {
    return { erro: "API key obrigatória pra esse provider." };
  }

  await prisma.configuracaoGateway.upsert({
    where: { id: "singleton" },
    update: { provider, ambiente, apiKey: apiKey || null, webhookToken: webhookToken || null, atualizadoPor: usuario.id },
    create: {
      id: "singleton",
      provider,
      ambiente,
      apiKey: apiKey || null,
      webhookToken: webhookToken || null,
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
