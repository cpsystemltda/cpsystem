"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { tierPorAtivos } from "@/lib/validators";
import { registrarAuditoria } from "@/lib/auditoria";

type Result = { erro?: string; ok?: boolean };

const PRECOS = { BASICO: 397, PREMIUM: 997 };

export async function cadastrarAnalistaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // Restrito ao admin do PO (em produção: roles)
  // Aqui no MVP, permite qualquer admin cadastrar.
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem cadastrar analistas." };

  const cpf = String(formData.get("cpf") || "").replace(/\D/g, "");
  if (cpf.length !== 11) return { erro: "CPF inválido." };

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
        pix: String(formData.get("pix") || "") || null,
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

  const hoje = new Date();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const analistas = await prisma.analista.findMany({
    where: { ativo: true },
    include: {
      contasIndicadas: {
        where: {
          statusAssinatura: "ATIVA",
          // Gatilho: a conta precisa ter pelo menos UMA Cobranca PAGA
          // historicamente — protege contra trial nao convertido.
          cobrancas: { some: { status: "PAGA" } },
        },
      },
    },
  });

  const ops: Promise<unknown>[] = [];
  for (const a of analistas) {
    const ativos = a.contasIndicadas.length;
    if (ativos === 0) continue;
    const { tier, percentual } = tierPorAtivos(ativos);

    for (const conta of a.contasIndicadas) {
      const valorBase = PRECOS[conta.plano as "BASICO" | "PREMIUM"];
      const valor = (valorBase * percentual) / 100;

      ops.push(
        prisma.comissao.upsert({
          where: { analistaId_contaId_competencia: { analistaId: a.id, contaId: conta.id, competencia } },
          update: { valorBase, tier, percentual, valor },
          create: { analistaId: a.id, contaId: conta.id, competencia, valorBase, tier, percentual, valor },
        }),
      );
    }
  }
  await Promise.all(ops);

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
