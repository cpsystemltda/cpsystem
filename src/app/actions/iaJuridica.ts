"use server";

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import { analisarContratoIA, type AnaliseJuridica } from "@/lib/iaJuridica";

export type AnalisarContratoResult =
  | { ok: true; analise: AnaliseJuridica; demo: boolean }
  | { ok: false; erro: string };

export async function analisarContratoAction(contratoId: string): Promise<AnalisarContratoResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId: usuario.contaId } },
    include: { itens: { select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true } } },
  });
  if (!contrato) return { ok: false, erro: "Contrato não encontrado." };

  const demo = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "";
  try {
    const analise = await analisarContratoIA(contrato);
    return { ok: true, analise, demo };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Falha na análise." };
  }
}
