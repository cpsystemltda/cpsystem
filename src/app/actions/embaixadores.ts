"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { calcularComissoesDoMes } from "@/lib/comissaoEmbaixador";

type Result = { erro?: string; ok?: boolean };

export async function cadastrarAnalistaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // Restrito ao admin do PO (em produção: roles)
  // Aqui no MVP, permite qualquer admin cadastrar.
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem cadastrar analistas." };

  const cpf = String(formData.get("cpf") || "").replace(/\D/g, "");
  if (cpf.length !== 11) return { erro: "CPF inválido." };

  // Regina 13/07: PIX obrigatório — analista recebe comissão via PIX
  // automático dia 20 de cada mês.
  const pix = String(formData.get("pix") || "").trim();
  if (pix.length < 4) return { erro: "Chave PIX obrigatória (CPF, e-mail, celular ou aleatória)." };

  if (await prisma.analista.findUnique({ where: { cpf } })) return { erro: "CPF já cadastrado." };

  try {
    const a = await prisma.analista.create({
      data: {
        nomeCompleto: String(formData.get("nomeCompleto") || ""),
        cpf,
        telefone: String(formData.get("telefone") || ""),
        endereco: String(formData.get("endereco") || ""),
        email: String(formData.get("email") || ""),
        banco: String(formData.get("banco") || "") || null,
        agencia: String(formData.get("agencia") || "") || null,
        contaCorrente: String(formData.get("contaCorrente") || "") || null,
        pix,
        razaoSocial: String(formData.get("razaoSocial") || "") || null,
        nomeFantasia: String(formData.get("nomeFantasia") || "") || null,
        cnpj: String(formData.get("cnpj") || "") || null,
        divulgacaoUrl: String(formData.get("divulgacaoUrl") || "") || null,
        ativo: true,
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Analista",
      recursoId: a.id,
      resumo: a.nomeCompleto,
    });

    revalidatePath("/embaixadores");
    return { ok: true };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro." };
  }
}

export async function vincularEmbaixadorAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const analistaId = String(formData.get("analistaId") || "");

  if (!analistaId) {
    await prisma.conta.update({ where: { id: usuario.contaId }, data: { embaixadorId: null } });
    revalidatePath("/dashboard");
    return { ok: true };
  }

  const a = await prisma.analista.findUnique({ where: { id: analistaId } });
  if (!a || !a.ativo) return { erro: "Analista não encontrado ou inativo." };

  await prisma.conta.update({ where: { id: usuario.contaId }, data: { embaixadorId: analistaId } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Conta",
    resumo: `Vinculou embaixador ${a.nomeCompleto}`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/embaixadores");
  return { ok: true };
}

// Calcula e gera comissões da competência atual.
//
// Regra de elegibilidade (Regina 07/06): a conta indicada SO conta como
// "ativa pro embaixador" depois de ter pago pelo menos UMA fatura
// (Cobranca.status=PAGA). Trial nao gera comissao. Apos a 1a fatura,
// a comissao e VITALICIA enquanto a conta continuar pagando (basta
// ter Cobranca.status=ATIVA no mes).
export async function calcularComissoesDoMesAction(_p: Result | null, _formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem rodar o cálculo." };

  await calcularComissoesDoMes();

  revalidatePath("/embaixadores");
  revalidatePath("/honorarios");
  return { ok: true };
}

export async function marcarComissaoPagaAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") throw new Error("Apenas admins.");
  const id = String(formData.get("comissaoId"));
  await prisma.comissao.update({ where: { id }, data: { paga: true, pagaEm: new Date() } });
  revalidatePath("/embaixadores");
  revalidatePath("/honorarios");
}
