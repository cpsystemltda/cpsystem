"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";

/**
 * Troca o colaborador responsável pelo acompanhamento de um fornecimento.
 *
 * Demanda de cliente 24/09/2026. Existe separado da edição do fornecimento
 * porque quem acompanha muda com frequência — férias, troca de área, saída da
 * empresa — e abrir o cadastro inteiro para mexer num nome é onde se erra
 * outro campo sem querer.
 *
 * Duas conferências que não são formalidade:
 *
 * 1. **O fornecimento é da conta de quem pede.** Sem isso, um id vindo do
 *    formulário alcançaria documento de outra empresa.
 * 2. **O colaborador indicado também é da conta.** O `<select>` só mostra a
 *    equipe certa, mas formulário é entrada do usuário, não verdade — e o
 *    nome do responsável aparece na tela do fornecimento, então apontar
 *    alguém de fora vazaria o nome dessa pessoa.
 */
export async function definirResponsavelAction(
  _p: { erro?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenhoId = String(formData.get("empenhoId") || "");
  const responsavelId = String(formData.get("responsavelId") || "").trim();

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    select: { id: true },
  });
  if (!empenho) return { erro: "Fornecimento não encontrado." };

  let alvo: string | null = null;
  if (responsavelId) {
    const u = await prisma.usuario.findFirst({
      where: { id: responsavelId, contaId: usuario.contaId },
      select: { id: true },
    });
    if (!u) return { erro: "Colaborador não encontrado na sua equipe." };
    alvo = u.id;
  }

  await prisma.empenho.update({
    where: { id: empenho.id },
    data: { responsavelId: alvo },
  });

  revalidatePath(`/execucao/${empenho.id}`);
  revalidatePath("/execucao");
  return { ok: true };
}
