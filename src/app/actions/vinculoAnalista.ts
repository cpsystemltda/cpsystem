"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { notificar } from "@/lib/notificacoes";

type Result = { erro?: string; ok?: boolean; vinculoId?: string };

// EMPRESA → vincula um analista ao seu grupo
export async function criarVinculoAnalistaAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (usuario.conta.tipo !== "EMPRESA") return { erro: "Só contas do tipo EMPRESA podem vincular analistas." };
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem vincular analistas." };

  const analistaId = String(formData.get("analistaId") || "");
  const percentual = Number(formData.get("percentualComissao") || 0);
  const fixo = Number(formData.get("fixoMensal") || 0);
  const diaVcto = Number(formData.get("diaVencimentoFixo") || 5);
  const dataInicioStr = String(formData.get("dataInicio") || "");
  const dataInicio = dataInicioStr ? new Date(dataInicioStr) : new Date();

  if (!analistaId) return { erro: "Selecione um analista." };
  if (percentual < 0 || percentual > 100) return { erro: "Percentual fora do intervalo (0-100)." };
  if (fixo < 0) return { erro: "Fixo mensal inválido." };
  if (diaVcto < 1 || diaVcto > 28) return { erro: "Dia de vencimento entre 1 e 28." };

  const analista = await prisma.analista.findUnique({ where: { id: analistaId } });
  if (!analista || !analista.ativo) return { erro: "Analista não encontrado ou inativo." };

  // Encerra vínculo anterior ATIVO entre a mesma conta e analista (substituição)
  await prisma.vinculoAnalista.updateMany({
    where: { contaId: usuario.contaId, analistaId, status: "ATIVO" },
    data: { status: "ENCERRADO", encerradoEm: new Date() },
  });

  try {
    const vinculo = await prisma.vinculoAnalista.create({
      data: {
        contaId: usuario.contaId,
        analistaId,
        dataInicio,
        percentualComissao: percentual,
        fixoMensal: fixo,
        diaVencimentoFixo: diaVcto,
        status: "ATIVO",
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "VinculoAnalista",
      recursoId: vinculo.id,
      resumo: `Vinculou ${analista.nomeCompleto} (${percentual}% + R$${fixo}/mês a partir de ${dataInicio.toLocaleDateString("pt-BR")})`,
    });

    // Notifica analista (se a conta dele existir)
    if (analista.contaId) {
      const usuariosAnalista = await prisma.usuario.findMany({ where: { contaId: analista.contaId } });
      for (const u of usuariosAnalista) {
        await notificar({
          usuarioId: u.id,
          tipo: "VINCULO_CRIADO",
          titulo: `Você foi vinculado a uma nova empresa`,
          descricao: `Comissão de ${percentual}% + fixo R$ ${fixo.toFixed(2)}/mês a partir de ${dataInicio.toLocaleDateString("pt-BR")}.`,
          link: "/painel-analista",
          recursoTipo: "VinculoAnalista",
          recursoId: vinculo.id,
        });
      }
    }

    revalidatePath("/vinculos");
    revalidatePath("/painel-analista");
    return { ok: true, vinculoId: vinculo.id };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao vincular." };
  }
}

// EMPRESA → atualiza fixo mensal e dia de vcto (não pode mexer no %, isso é do analista)
export async function atualizarFixoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (usuario.conta.tipo !== "EMPRESA") return { erro: "Apenas empresas." };
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins." };

  const vinculoId = String(formData.get("vinculoId") || "");
  const v = await prisma.vinculoAnalista.findFirst({ where: { id: vinculoId, contaId: usuario.contaId } });
  if (!v) return { erro: "Vínculo não encontrado." };

  const fixo = Number(formData.get("fixoMensal") || 0);
  const diaVcto = Number(formData.get("diaVencimentoFixo") || v.diaVencimentoFixo);
  if (fixo < 0) return { erro: "Fixo inválido." };
  if (diaVcto < 1 || diaVcto > 28) return { erro: "Dia entre 1-28." };

  await prisma.vinculoAnalista.update({
    where: { id: vinculoId },
    data: { fixoMensal: fixo, diaVencimentoFixo: diaVcto },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "VinculoAnalista",
    recursoId: vinculoId,
    resumo: `Fixo R$ ${fixo}/mês (dia ${diaVcto})`,
  });

  revalidatePath("/vinculos");
  revalidatePath("/painel-analista");
  return { ok: true };
}

// ANALISTA → atualiza só o próprio percentual de comissão
/**
 * Atualiza o percentual da comissão variável de um vínculo.
 *
 * Quem pode editar (regra da spec original do painel do analista):
 *   - Conta ANALISTA: o próprio analista (só os vínculos dele).
 *   - Conta EMPRESA com perfil ADMIN: o admin da empresa fornecedora
 *     (só os vínculos da própria conta).
 *
 * Mudança vale só pra execuções futuras — comissões já criadas em
 * ComissaoExecucao têm o percentual snapshotado e não são reescritas
 * retroativamente (essa é a regra de override). Para alterar uma comissão
 * já existente, use overridePercentualComissaoAction com justificativa.
 */
export async function atualizarPercentualAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  const vinculoId = String(formData.get("vinculoId") || "");
  const percentual = Number(formData.get("percentualComissao") || 0);
  if (percentual < 0 || percentual > 100) return { erro: "Percentual fora do intervalo." };

  let v: { id: string; percentualComissao: number } | null = null;
  let resumoQuem = "";

  if (usuario.conta.tipo === "ANALISTA") {
    const analista = await prisma.analista.findUnique({ where: { contaId: usuario.contaId } });
    if (!analista) return { erro: "Conta de analista sem perfil cadastrado." };
    v = await prisma.vinculoAnalista.findFirst({
      where: { id: vinculoId, analistaId: analista.id },
      select: { id: true, percentualComissao: true },
    });
    resumoQuem = "Analista";
  } else if (usuario.conta.tipo === "EMPRESA") {
    if (usuario.perfil !== "ADMIN") {
      return { erro: "Apenas o ADMIN da empresa pode alterar o percentual de comissão." };
    }
    v = await prisma.vinculoAnalista.findFirst({
      where: { id: vinculoId, contaId: usuario.contaId },
      select: { id: true, percentualComissao: true },
    });
    resumoQuem = "Admin da empresa";
  } else {
    return { erro: "Apenas analista ou ADMIN da empresa pode alterar o percentual." };
  }

  if (!v) return { erro: "Vínculo não encontrado ou sem permissão." };

  await prisma.vinculoAnalista.update({ where: { id: vinculoId }, data: { percentualComissao: percentual } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "VinculoAnalista",
    recursoId: vinculoId,
    resumo: `${resumoQuem} atualizou comissão de ${v.percentualComissao}% para ${percentual}%`,
  });

  revalidatePath("/painel-analista");
  return { ok: true };
}

// EMPRESA → encerra vínculo
export async function encerrarVinculoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (usuario.conta.tipo !== "EMPRESA") return { erro: "Apenas empresas." };
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins." };

  const vinculoId = String(formData.get("vinculoId") || "");
  const v = await prisma.vinculoAnalista.findFirst({
    where: { id: vinculoId, contaId: usuario.contaId },
    include: { analista: true },
  });
  if (!v) return { erro: "Vínculo não encontrado." };

  await prisma.vinculoAnalista.update({
    where: { id: vinculoId },
    data: { status: "ENCERRADO", encerradoEm: new Date() },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "VinculoAnalista",
    recursoId: vinculoId,
    resumo: `Encerrou vínculo com ${v.analista.nomeCompleto}`,
  });

  // Notifica analista
  if (v.analista.contaId) {
    const usuariosAnalista = await prisma.usuario.findMany({ where: { contaId: v.analista.contaId } });
    for (const u of usuariosAnalista) {
      await notificar({
        usuarioId: u.id,
        tipo: "VINCULO_ENCERRADO",
        titulo: "Um vínculo foi encerrado",
        descricao: `O vínculo com a empresa cliente foi encerrado. Comissões já cadastradas permanecem.`,
        recursoTipo: "VinculoAnalista",
        recursoId: vinculoId,
      });
    }
  }

  revalidatePath("/vinculos");
  return { ok: true };
}

export async function marcarFixoPagoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  if (usuario.conta.tipo !== "EMPRESA") throw new Error("Apenas empresas.");
  if (usuario.perfil !== "ADMIN") throw new Error("Apenas admins.");

  const vinculoId = String(formData.get("vinculoId"));
  const competencia = String(formData.get("competencia"));

  const v = await prisma.vinculoAnalista.findFirst({ where: { id: vinculoId, contaId: usuario.contaId } });
  if (!v) throw new Error("Vínculo não encontrado.");

  await prisma.pagamentoFixoMensal.upsert({
    where: { vinculoId_competencia: { vinculoId, competencia } },
    create: { vinculoId, competencia, valor: v.fixoMensal, paga: true, pagaEm: new Date() },
    update: { paga: true, pagaEm: new Date(), valor: v.fixoMensal },
  });

  revalidatePath("/vinculos");
  revalidatePath("/painel-analista");
}
