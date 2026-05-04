"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { LIMITE_CARONA_POR_ORGAO_PCT, LIMITE_CARONA_TOTAL_PCT, normalizarCnpj } from "@/lib/validators";

type Result = { erro?: string; ok?: boolean };

async function valorTotalAta(ataId: string): Promise<number> {
  const itens = await prisma.ataItem.findMany({ where: { ataId }, select: { valorTotal: true } });
  return itens.reduce((s, i) => s + i.valorTotal, 0);
}

export async function adicionarOrgaoNaAtaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "");
  const tipo = String(formData.get("tipo") || "") as "GERENCIADOR" | "PARTICIPANTE" | "CARONA";

  const ata = await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } });
  if (!ata) return { erro: "Ata não encontrada." };

  if (tipo === "CARONA" && !ata.aceitaCarona) {
    return { erro: "Esta Ata não aceita carona — habilite no cadastro principal antes." };
  }

  let limiteValor: number | null = null;
  let limitePct: number | null = null;

  if (tipo === "CARONA") {
    const valorTotal = await valorTotalAta(ataId);
    limitePct = formData.get("limitePct") ? Number(formData.get("limitePct")) : LIMITE_CARONA_POR_ORGAO_PCT;
    if (limitePct > LIMITE_CARONA_POR_ORGAO_PCT) {
      return {
        erro: `Limite por carona não pode exceder ${LIMITE_CARONA_POR_ORGAO_PCT}% (Lei 14.133/2021 art. 86).`,
      };
    }

    // Verifica limite total dos caronas
    const caronasExistentes = await prisma.orgaoNaAta.findMany({
      where: { ataId, tipo: "CARONA" },
      select: { limitePct: true },
    });
    const somaPct = caronasExistentes.reduce((s, c) => s + (c.limitePct || 0), 0) + limitePct;
    if (somaPct > LIMITE_CARONA_TOTAL_PCT) {
      return {
        erro: `Soma dos limites de carona ultrapassaria ${LIMITE_CARONA_TOTAL_PCT}% (atual: ${somaPct.toFixed(0)}%).`,
      };
    }

    limiteValor = (valorTotal * limitePct) / 100;
  }

  await prisma.orgaoNaAta.create({
    data: {
      ataId,
      tipo,
      nome: String(formData.get("nome") || ""),
      cnpj: normalizarCnpj(String(formData.get("cnpj") || "")),
      endereco: String(formData.get("endereco") || ""),
      email: String(formData.get("email") || "") || null,
      telefone: String(formData.get("telefone") || "") || null,
      limiteValor,
      limitePct,
    },
  });

  revalidatePath(`/atas/${ataId}`);
  return { ok: true };
}

export async function adicionarEnderecoEntregaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  const orgaoNaAtaId = String(formData.get("orgaoNaAtaId") || "") || undefined;

  // Validações de pertinência
  if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Ata inválida." };
  if (contratoId && !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Contrato inválido." };
  if (empenhoId && !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Empenho inválido." };

  await prisma.enderecoEntrega.create({
    data: {
      rotulo: String(formData.get("rotulo") || "") || null,
      endereco: String(formData.get("endereco") || ""),
      ataId: ataId || null,
      contratoId: contratoId || null,
      empenhoId: empenhoId || null,
      orgaoNaAtaId: orgaoNaAtaId || null,
    },
  });

  if (ataId) revalidatePath(`/atas/${ataId}`);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
  return { ok: true };
}

export async function adicionarPontoFocalAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const ataId = String(formData.get("ataId") || "") || undefined;
  const contratoId = String(formData.get("contratoId") || "") || undefined;
  const empenhoId = String(formData.get("empenhoId") || "") || undefined;
  const orgaoNaAtaId = String(formData.get("orgaoNaAtaId") || "") || undefined;

  if (ataId && !(await prisma.ata.findFirst({ where: { id: ataId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Ata inválida." };
  if (contratoId && !(await prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Contrato inválido." };
  if (empenhoId && !(await prisma.empenho.findFirst({ where: { id: empenhoId, empresa: { contaId: usuario.contaId } } })))
    return { erro: "Empenho inválido." };

  await prisma.pontoFocal.create({
    data: {
      funcao: String(formData.get("funcao") || "CONTATO_GERAL") as "GESTOR" | "FISCAL_TECNICO" | "FISCAL_ADMINISTRATIVO" | "RESPONSAVEL_SETOR" | "CONTATO_GERAL",
      nome: String(formData.get("nome") || ""),
      email: String(formData.get("email") || "") || null,
      telefone: String(formData.get("telefone") || "") || null,
      ataId: ataId || null,
      contratoId: contratoId || null,
      empenhoId: empenhoId || null,
      orgaoNaAtaId: orgaoNaAtaId || null,
    },
  });

  if (ataId) revalidatePath(`/atas/${ataId}`);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
  return { ok: true };
}
