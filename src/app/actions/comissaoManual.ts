"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { pagarComissaoAvulsa } from "@/lib/pagamentoAnalista";
import { prisma } from "@/lib/prisma";

/**
 * Pagamento avulso da comissão do analista (Regina 24/08).
 *
 * O repasse automático só sai quando o dinheiro do cliente já está na conta —
 * cartão de crédito leva ~32 dias pra ser liberado pelo gateway. Quando a
 * Regina decide antecipar (foi o caso do Igor, que ficou sem receber porque o
 * cliente pagou um dia depois da data de repasse), o botão é este.
 *
 * Só super admin: move dinheiro de verdade, via PIX, na hora.
 */
export type ResultadoComissaoManual = { ok?: true; valor?: number; erro?: string };

export async function pagarComissaoAgoraAction(
  _prev: ResultadoComissaoManual | null,
  formData: FormData,
): Promise<ResultadoComissaoManual> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma podem pagar comissão." };

  const comissaoId = String(formData.get("comissaoId") || "").trim();
  if (!comissaoId) return { erro: "Comissão não informada." };

  const antes = await prisma.comissao.findUnique({
    where: { id: comissaoId },
    select: { competencia: true, valor: true, analista: { select: { nomeCompleto: true } } },
  });

  const r = await pagarComissaoAvulsa(comissaoId);
  if (!r.ok) return { erro: r.erro };

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Comissao",
    recursoId: comissaoId,
    resumo: `Pagou manualmente R$ ${r.valor.toFixed(2)} de comissão (${antes?.competencia ?? "?"}) para ${antes?.analista.nomeCompleto ?? "analista"} — PIX ${r.transferId}`,
  });

  revalidatePath("/embaixadores");
  revalidatePath("/honorarios");
  return { ok: true, valor: r.valor };
}
