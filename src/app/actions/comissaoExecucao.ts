"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { calcularDiff, CAMPOS_COMISSAO_EXECUCAO } from "@/lib/diff";
import { salvarArquivo } from "@/lib/uploads";

type Result = { erro?: string; ok?: boolean };

type StatusComissao = "AGUARDANDO_ORGAO" | "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";

/**
 * Action exclusiva do analista: atualiza Linha B de uma execução.
 * Regras de negócio:
 *   - Usuário precisa ser ANALISTA logado e ser dono da comissão.
 *   - Status AGUARDANDO_ORGAO não pode virar PAGO/PAGO_PARCIAL — empresa
 *     ainda não recebeu do órgão, então não há o que cobrar.
 *   - PAGO sem valorRecebido: assume valorCalculado (cobrança integral).
 *   - PAGO_PARCIAL exige valorRecebido > 0 e < valorCalculado.
 */
export async function marcarComissaoExecucaoAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.conta.tipo !== "ANALISTA" && !usuario.superAdmin) {
    return { erro: "Apenas analistas podem marcar comissões." };
  }

  const analista = await prisma.analista.findUnique({
    where: { contaId: usuario.contaId },
    select: { id: true },
  });
  if (!analista && !usuario.superAdmin) {
    return { erro: "Conta de analista não encontrada." };
  }

  const id = String(formData.get("id") || "");
  const comissaoAntes = await prisma.comissaoExecucao.findUnique({
    where: { id },
  });
  if (!comissaoAntes) return { erro: "Comissão não encontrada." };

  // Permissão: analista só edita as próprias comissões
  if (!usuario.superAdmin && analista && comissaoAntes.analistaId !== analista.id) {
    return { erro: "Sem permissão para esta comissão." };
  }

  const novoStatus = String(formData.get("status") || "") as StatusComissao;
  if (
    !["AGUARDANDO_ORGAO", "A_RECEBER", "ATRASADO", "PAGO", "PAGO_PARCIAL"].includes(novoStatus)
  ) {
    return { erro: "Status inválido." };
  }

  // Trava: não pode marcar PAGO se órgão ainda não pagou a empresa.
  if (
    comissaoAntes.status === "AGUARDANDO_ORGAO" &&
    (novoStatus === "PAGO" || novoStatus === "PAGO_PARCIAL")
  ) {
    return {
      erro: "Esta comissão ainda está aguardando o pagamento do órgão à empresa. Marcar a Linha A como paga primeiro.",
    };
  }

  const valorRecebidoInput = formData.get("valorRecebido");
  let valorRecebido =
    valorRecebidoInput != null && String(valorRecebidoInput).trim() !== ""
      ? Number(valorRecebidoInput)
      : null;

  if (novoStatus === "PAGO" && (valorRecebido === null || valorRecebido <= 0)) {
    // PAGO sem valor explícito → cobra integralmente o valor calculado
    valorRecebido = comissaoAntes.valorCalculado;
  }
  if (novoStatus === "PAGO_PARCIAL") {
    if (valorRecebido === null || valorRecebido <= 0) {
      return { erro: "Pago parcial exige um valor recebido > 0." };
    }
    if (valorRecebido >= comissaoAntes.valorCalculado) {
      return {
        erro: "Valor recebido cobre toda a comissão. Use status 'Pago' em vez de 'Pago parcial'.",
      };
    }
  }
  if (novoStatus === "A_RECEBER" || novoStatus === "ATRASADO" || novoStatus === "AGUARDANDO_ORGAO") {
    valorRecebido = 0;
  }

  const dataPagamentoIso = String(formData.get("dataPagamento") || "");
  let dataPagamento: Date | null = null;
  if (novoStatus === "PAGO" || novoStatus === "PAGO_PARCIAL") {
    dataPagamento = dataPagamentoIso ? new Date(dataPagamentoIso) : new Date();
    if (isNaN(dataPagamento.getTime())) return { erro: "Data do pagamento inválida." };
  }

  const observacao = String(formData.get("observacao") || "") || null;

  // Upload opcional de comprovante
  let comprovanteUrl: string | null | undefined = undefined;
  const arquivo = formData.get("comprovante") as File | null;
  if (arquivo && arquivo.size > 0) {
    const salvo = await salvarArquivo(arquivo);
    comprovanteUrl = salvo.url;
  }

  const dadosNovos = {
    status: novoStatus,
    valorRecebido: valorRecebido ?? 0,
    dataPagamento,
    observacao,
    ...(comprovanteUrl !== undefined ? { comprovanteUrl } : {}),
  };

  await prisma.comissaoExecucao.update({
    where: { id },
    data: dadosNovos,
  });

  const mudancas = calcularDiff(
    comissaoAntes as unknown as Record<string, unknown>,
    dadosNovos as Record<string, unknown>,
    CAMPOS_COMISSAO_EXECUCAO,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ComissaoExecucao",
    recursoId: id,
    titulo: `Comissão de execução`,
    mudancas,
  });

  revalidatePath("/painel-analista");
  return { ok: true };
}

/**
 * Override do percentual de uma comissão específica. Exige justificativa.
 * Recalcula valorCalculado com base no valorBasePago atual.
 */
export async function overridePercentualComissaoAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.conta.tipo !== "ANALISTA" && !usuario.superAdmin) {
    return { erro: "Apenas analistas podem ajustar percentual." };
  }
  const analista = await prisma.analista.findUnique({
    where: { contaId: usuario.contaId },
    select: { id: true },
  });

  const id = String(formData.get("id") || "");
  const comissaoAntes = await prisma.comissaoExecucao.findUnique({ where: { id } });
  if (!comissaoAntes) return { erro: "Comissão não encontrada." };
  if (!usuario.superAdmin && analista && comissaoAntes.analistaId !== analista.id) {
    return { erro: "Sem permissão." };
  }
  if (comissaoAntes.status === "PAGO") {
    return { erro: "Não é possível alterar percentual de comissão já paga." };
  }

  const novoPercentual = Number(formData.get("percentual") || 0);
  const justificativa = String(formData.get("observacaoOverride") || "").trim();
  if (!Number.isFinite(novoPercentual) || novoPercentual < 0 || novoPercentual > 100) {
    return { erro: "Percentual deve estar entre 0 e 100." };
  }
  if (!justificativa) return { erro: "Informe a justificativa do override." };

  const dadosNovos = {
    percentual: novoPercentual,
    percentualOverride: true,
    observacaoOverride: justificativa,
    valorCalculado: comissaoAntes.valorBasePago * (novoPercentual / 100),
  };

  await prisma.comissaoExecucao.update({ where: { id }, data: dadosNovos });

  const mudancas = calcularDiff(
    comissaoAntes as unknown as Record<string, unknown>,
    dadosNovos as Record<string, unknown>,
    CAMPOS_COMISSAO_EXECUCAO,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ComissaoExecucao",
    recursoId: id,
    titulo: `Override de % na comissão`,
    mudancas,
  });

  revalidatePath("/painel-analista");
  return { ok: true };
}
