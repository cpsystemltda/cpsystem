"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { traduzirErroGateway } from "@/lib/pagamentoAnalista";

/**
 * Cancelamento de cobrança pelo gestor da plataforma (Regina 24/08).
 *
 * Existia um buraco no caminho: cobrança aberta por engano — a de R$ 997 que o
 * cron gerou contra a própria conta da Regina, ou a de R$ 10 do teste de
 * integração — só dava pra cancelar entrando no painel do Asaas. Agora sai
 * daqui, cancelando no gateway e no banco de uma vez, com auditoria.
 *
 * Cobrança PAGA não é cancelada por aqui: estorno é outra conversa, e some com
 * o histórico financeiro se for feito às cegas.
 */
export type ResultadoCancelamento = { ok?: true; erro?: string };

export async function cancelarCobrancaAdminAction(
  _prev: ResultadoCancelamento | null,
  formData: FormData,
): Promise<ResultadoCancelamento> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };

  const cobrancaId = String(formData.get("cobrancaId") || "").trim();
  if (!cobrancaId) return { erro: "Cobrança não informada." };

  const cobranca = await prisma.cobranca.findUnique({
    where: { id: cobrancaId },
    select: {
      id: true,
      contaId: true,
      status: true,
      valor: true,
      competencia: true,
      gatewayChargeId: true,
    },
  });
  if (!cobranca) return { erro: "Cobrança não encontrada." };
  if (cobranca.status === "PAGA") {
    return { erro: "Esta cobrança já foi paga — cancelar aqui não devolve o dinheiro. Use estorno no gateway." };
  }
  if (cobranca.status === "CANCELADA") return { erro: "Esta cobrança já está cancelada." };

  // Cancela no gateway primeiro: se falhar lá e a gente marcasse cancelada
  // aqui, o cliente continuaria recebendo lembrete do Asaas de uma cobrança
  // que o sistema considera morta.
  if (cobranca.gatewayChargeId) {
    try {
      const gateway = await getGateway();
      await gateway.cancelarCobranca(cobranca.gatewayChargeId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 404/já removida no gateway não impede marcar aqui.
      const sumiuLa = msg.includes("404") || msg.toLowerCase().includes("not found");
      if (!sumiuLa) return { erro: traduzirErroGateway(msg) };
    }
  }

  await prisma.cobranca.update({
    where: { id: cobranca.id },
    data: { status: "CANCELADA" },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Cobranca",
    recursoId: cobranca.id,
    resumo: `Cancelou cobrança de R$ ${cobranca.valor.toFixed(2)} (${cobranca.competencia}) pelo painel do gestor`,
  });

  revalidatePath("/admin/gateway");
  revalidatePath("/conta/assinatura");
  return { ok: true };
}
