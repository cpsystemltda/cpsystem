"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { calcularDiff } from "@/lib/diff";
import { salvarArquivo } from "@/lib/uploads";

type Result = { erro?: string; ok?: boolean };
type StatusFixo = "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";

const CAMPOS_FIXO = [
  { chave: "status", rotulo: "Status da comissão" },
  { chave: "valor", rotulo: "Valor combinado" },
  { chave: "valorRecebido", rotulo: "Valor recebido" },
  { chave: "vencimento", rotulo: "Vencimento" },
  { chave: "pagaEm", rotulo: "Data do pagamento" },
  { chave: "observacoes", rotulo: "Observação" },
];

// Carrega a linha + valida que `contaId` é OU do analista (dono da comissão)
// OU da empresa-cliente (dona do vínculo) — ambos podem marcar pagamento.
// Super admin passa por cima.
async function carregarLinhaPagamentoFixo(id: string, contaId: string, superAdmin: boolean) {
  const linha = await prisma.pagamentoFixoMensal.findUnique({
    where: { id },
    include: {
      vinculo: {
        select: {
          analistaId: true,
          contaId: true,
          analista: { select: { contaId: true } },
        },
      },
    },
  });
  if (!linha) return null;
  if (superAdmin) return linha;
  const contaDoAnalista = linha.vinculo.analista?.contaId;
  const contaDaEmpresa = linha.vinculo.contaId;
  if (contaDoAnalista !== contaId && contaDaEmpresa !== contaId) {
    return "sem-permissao";
  }
  return linha;
}

/**
 * Marca um PagamentoFixoMensal — status + valor recebido + data + comprovante.
 * Apenas o analista dono da linha (ou super admin) pode marcar.
 */
export async function marcarPagamentoFixoAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("id") || "");

  const linha = await carregarLinhaPagamentoFixo(id, usuario.contaId, usuario.superAdmin);
  if (!linha) return { erro: "Comissão não encontrada." };
  if (linha === "sem-permissao") return { erro: "Sem permissão." };

  const novoStatus = String(formData.get("status") || "") as StatusFixo;
  if (!["A_RECEBER", "ATRASADO", "PAGO", "PAGO_PARCIAL"].includes(novoStatus)) {
    return { erro: "Status inválido." };
  }

  const valorRecebidoInput = formData.get("valorRecebido");
  let valorRecebido =
    valorRecebidoInput != null && String(valorRecebidoInput).trim() !== ""
      ? Number(valorRecebidoInput)
      : null;

  if (novoStatus === "PAGO" && (valorRecebido === null || valorRecebido <= 0)) {
    valorRecebido = linha.valor;
  }
  if (novoStatus === "PAGO_PARCIAL") {
    if (valorRecebido === null || valorRecebido <= 0) {
      return { erro: "Pago parcial exige um valor recebido > 0." };
    }
    if (valorRecebido >= linha.valor) {
      return {
        erro: "Valor recebido cobre o total. Use status 'Pago' em vez de 'Pago parcial'.",
      };
    }
  }
  if (novoStatus === "A_RECEBER" || novoStatus === "ATRASADO") {
    valorRecebido = 0;
  }

  const dataPagamentoIso = String(formData.get("dataPagamento") || "");
  let pagaEm: Date | null = null;
  if (novoStatus === "PAGO" || novoStatus === "PAGO_PARCIAL") {
    pagaEm = dataPagamentoIso ? new Date(dataPagamentoIso) : new Date();
    if (isNaN(pagaEm.getTime())) return { erro: "Data do pagamento inválida." };
  }

  const observacoes = String(formData.get("observacoes") || "") || null;

  let comprovanteUrl: string | null | undefined = undefined;
  const arquivo = formData.get("comprovante") as File | null;
  if (arquivo && arquivo.size > 0) {
    const salvo = await salvarArquivo(arquivo);
    comprovanteUrl = salvo.url;
  }

  const dadosNovos = {
    status: novoStatus,
    valorRecebido: valorRecebido ?? 0,
    pagaEm,
    paga: novoStatus === "PAGO",
    observacoes,
    ...(comprovanteUrl !== undefined ? { comprovanteUrl } : {}),
  };

  await prisma.pagamentoFixoMensal.update({
    where: { id },
    data: dadosNovos,
  });

  const mudancas = calcularDiff(
    linha as unknown as Record<string, unknown>,
    dadosNovos as Record<string, unknown>,
    CAMPOS_FIXO,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "PagamentoFixoMensal",
    recursoId: id,
    titulo: `Comissão fixa ${linha.competencia}`,
    mudancas,
  });

  revalidatePath("/painel-analista");
  return { ok: true };
}

/**
 * Atualiza valor e/ou vencimento de uma linha individual. Editável a qualquer
 * momento mas dispara auditoria. Não muda status.
 */
export async function atualizarValorVencimentoFixoAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("id") || "");
  const linha = await carregarLinhaPagamentoFixo(id, usuario.contaId, usuario.superAdmin);
  if (!linha) return { erro: "Comissão não encontrada." };
  if (linha === "sem-permissao") return { erro: "Sem permissão." };

  const valor = Number(formData.get("valor") || 0);
  const vencimentoIso = String(formData.get("vencimento") || "");
  if (!(valor > 0)) return { erro: "Valor inválido." };

  const vencimento = vencimentoIso ? new Date(vencimentoIso) : null;
  if (vencimento && isNaN(vencimento.getTime())) {
    return { erro: "Vencimento inválido." };
  }

  const dadosNovos = { valor, vencimento };
  await prisma.pagamentoFixoMensal.update({ where: { id }, data: dadosNovos });

  const mudancas = calcularDiff(
    linha as unknown as Record<string, unknown>,
    dadosNovos as Record<string, unknown>,
    CAMPOS_FIXO,
  );
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "PagamentoFixoMensal",
    recursoId: id,
    titulo: `Comissão fixa ${linha.competencia}`,
    mudancas,
  });

  revalidatePath("/painel-analista");
  return { ok: true };
}

function ehMesFuturo(competencia: string): boolean {
  const hoje = new Date();
  const competenciaAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return competencia > competenciaAtual;
}

/**
 * Remove uma linha de comissão fixa. Permitido apenas para meses FUTUROS —
 * meses presentes ou passados ficam no histórico (mesmo se nunca foi cobrada).
 */
export async function excluirPagamentoFixoAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const id = String(formData.get("id") || "");
  const linha = await carregarLinhaPagamentoFixo(id, usuario.contaId, usuario.superAdmin);
  if (!linha) throw new Error("Comissão não encontrada.");
  if (linha === "sem-permissao") throw new Error("Sem permissão.");
  if (!ehMesFuturo(linha.competencia)) {
    throw new Error(
      "Só é possível excluir comissões de meses futuros. Meses passados ficam no histórico.",
    );
  }
  await prisma.pagamentoFixoMensal.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "PagamentoFixoMensal",
    recursoId: id,
    resumo: `Comissão fixa ${linha.competencia} removida (mês futuro)`,
  });

  revalidatePath("/painel-analista");
}
