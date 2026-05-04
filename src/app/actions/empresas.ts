"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { normalizarCnpj, novaEmpresaSchema } from "@/lib/validators";

const LIMITE_EMPRESAS_GRATIS = 4;

type ActionResult = { erro?: string; campos?: Record<string, string> };

export async function criarEmpresaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();

  const total = await prisma.empresa.count({ where: { contaId: usuario.contaId } });
  if (total >= LIMITE_EMPRESAS_GRATIS) {
    return {
      erro: `Limite de ${LIMITE_EMPRESAS_GRATIS} CNPJs atingido. A partir do 5º há cobrança adicional — fale com a equipe comercial.`,
    };
  }

  const parsed = novaEmpresaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos };
  }

  const v = parsed.data;
  const cnpj = normalizarCnpj(v.cnpj);

  const cnpjExiste = await prisma.empresa.findUnique({ where: { cnpj } });
  if (cnpjExiste) return { erro: "CNPJ já cadastrado." };

  await prisma.empresa.create({
    data: {
      contaId: usuario.contaId,
      razaoSocial: v.razaoSocial,
      nomeFantasia: v.nomeFantasia || null,
      cnpj,
      porte: v.porte,
      cnaePrincipal: v.cnaePrincipal,
      cnaesSecundarios: v.cnaesSecundarios || null,
      naturezaJuridica: v.naturezaJuridica,
      endereco: v.endereco,
      cep: v.cep.replace(/\D/g, ""),
      email: v.email,
      telefones: v.telefones,
      responsavel: v.responsavel,
    },
  });

  revalidatePath("/empresas");
  redirect("/empresas");
}
