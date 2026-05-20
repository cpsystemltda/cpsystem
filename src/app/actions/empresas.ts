"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, hashSenha } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { normalizarCnpj, novaEmpresaSchema } from "@/lib/validators";

const LIMITE_EMPRESAS_GRATIS = 4;

type ActionResult = { erro?: string; campos?: Record<string, string> };

export async function criarEmpresaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

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

  // Se a senha foi informada, garante que o e-mail não conflita com algum usuário existente
  // antes de tocar no banco — assim não vamos criar a Empresa pra depois falhar no Usuario.
  if (v.senha) {
    const emailEmUso = await prisma.usuario.findUnique({ where: { email: v.email.toLowerCase() } });
    if (emailEmUso) {
      return {
        erro: "Já existe um usuário com este e-mail. Use outro e-mail para o responsável ou deixe a senha em branco.",
        campos: { email: "E-mail já cadastrado em outro usuário." },
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
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

    if (v.senha) {
      await tx.usuario.create({
        data: {
          nome: v.responsavel,
          email: v.email.toLowerCase(),
          senhaHash: await hashSenha(v.senha),
          perfil: "OPERACIONAL",
          superAdmin: false,
          contaId: usuario.contaId,
        },
      });
    }

    return empresa;
  });

  revalidatePath("/empresas");
  redirect("/empresas");
}
