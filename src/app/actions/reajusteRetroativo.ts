"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarArquivo } from "@/lib/uploads";
import { sincronizarComissoesComEmpenhoPago } from "@/lib/comissaoExecucao";

type Result = { ok: true } | { ok: false; erro: string };

// Normalização de descrição idêntica à do saldo.ts — pra fallback de
// match de empenhoItem que não tem ataItemId.
function normalizarDescricao(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;]+$/, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((p) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p))
    .join(" ");
}

/**
 * Calcula a diferença de reajuste pra um empenho — quanto a empresa
 * teria a mais SE aplicasse o valor unitário atual do contrato/ata em
 * vez do valor congelado no empenho. Não persiste nada — só calcula.
 *
 * Estratégia:
 *  - Pra cada empenhoItem, busca o valorUnitario atual do item parent:
 *    1) Se empenho.contratoId: procura ContratoItem (do mesmo contrato)
 *       que case por ataItemId OU por descrição normalizada
 *    2) Se empenho.ataId direto: procura AtaItem que case por id OU descrição
 *  - Diferença = (qty × valorUnit atual) - empenhoItem.valorTotal
 *  - Soma de todas as diferenças = diferenca total do empenho
 */
export async function calcularPreviaReajusteRetroativoAction(
  empenhoId: string,
): Promise<
  | { ok: true; valorOriginal: number; valorReajustado: number; diferenca: number }
  | { ok: false; erro: string }
> {
  const usuario = await exigirUsuario();
  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    include: {
      itens: true,
      contrato: {
        include: { itens: true },
      },
      ata: {
        include: { itens: true },
      },
    },
  });
  if (!empenho) return { ok: false, erro: "Empenho não encontrado." };

  const previa = computarPrevia(empenho);
  return { ok: true, ...previa };
}

type EmpenhoComItens = {
  itens: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    ataItemId: string | null;
  }>;
  contrato: {
    itens: Array<{
      id: string;
      descricao: string;
      valorUnitario: number;
      ataItemId: string | null;
    }>;
  } | null;
  ata: {
    itens: Array<{
      id: string;
      descricao: string;
      valorUnitario: number;
    }>;
  } | null;
};

// Retorna a previa + um mapa empenhoItemId → novoValorUnitario
function computarPrevia(empenho: EmpenhoComItens): {
  valorOriginal: number;
  valorReajustado: number;
  diferenca: number;
  novosValores: Map<string, number>;
} {
  const fontes: Array<{ descricao: string; valorUnitario: number; ataItemId?: string | null }> = [];
  if (empenho.contrato) {
    for (const it of empenho.contrato.itens) {
      fontes.push({ descricao: it.descricao, valorUnitario: it.valorUnitario, ataItemId: it.ataItemId });
    }
  }
  if (empenho.ata) {
    for (const it of empenho.ata.itens) {
      fontes.push({ descricao: it.descricao, valorUnitario: it.valorUnitario, ataItemId: it.id });
    }
  }

  const novosValores = new Map<string, number>();
  let valorOriginal = 0;
  let valorReajustado = 0;

  for (const ei of empenho.itens) {
    valorOriginal += ei.valorTotal;

    // Tenta achar valor atual: por ataItemId primeiro, depois descrição
    let valorUnitAtual: number | null = null;
    if (ei.ataItemId) {
      const fonte = fontes.find((f) => f.ataItemId === ei.ataItemId);
      if (fonte) valorUnitAtual = fonte.valorUnitario;
    }
    if (valorUnitAtual === null) {
      const descNorm = normalizarDescricao(ei.descricao);
      const fonte = fontes.find((f) => normalizarDescricao(f.descricao) === descNorm);
      if (fonte) valorUnitAtual = fonte.valorUnitario;
    }
    // Sem match: usa o valor congelado (não reajusta)
    if (valorUnitAtual === null) valorUnitAtual = ei.valorUnitario;

    novosValores.set(ei.id, valorUnitAtual);
    valorReajustado += ei.quantidade * valorUnitAtual;
  }

  return {
    valorOriginal,
    valorReajustado,
    diferenca: valorReajustado - valorOriginal,
    novosValores,
  };
}

/**
 * Aplica o reajuste retroativo numa execução já paga. Cria
 * ReajusteRetroativo, atualiza valorUnitario/valorTotal dos itens do
 * empenho, recalcula comissões (vinculadas a esse empenho) com novo
 * valor base.
 *
 * Pré-condições:
 *  - Empenho deve estar com status PAGO (caso de uso é reajuste após pagamento)
 *  - Não pode existir ReajusteRetroativo prévio (1:1)
 *  - Diferença deve ser != 0 (sem sentido aplicar reajuste de R$ 0)
 */
export async function aplicarReajusteRetroativoAction(
  empenhoId: string,
  observacao?: string,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    include: {
      itens: true,
      contrato: { include: { itens: true } },
      ata: { include: { itens: true } },
      reajusteRetroativo: true,
    },
  });
  if (!empenho) return { ok: false, erro: "Empenho não encontrado." };
  if (empenho.status !== "PAGO") {
    return {
      ok: false,
      erro: "Reajuste retroativo só pode ser aplicado em execução já paga.",
    };
  }
  if (empenho.reajusteRetroativo) {
    return {
      ok: false,
      erro: "Esta execução já tem um reajuste retroativo aplicado.",
    };
  }

  const previa = computarPrevia(empenho);
  if (Math.abs(previa.diferenca) < 0.01) {
    return {
      ok: false,
      erro:
        "Sem reajuste a aplicar — os valores dos itens do contrato/ata estão idênticos aos do empenho.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Cria registro do reajuste
      await tx.reajusteRetroativo.create({
        data: {
          empenhoId,
          valorOriginal: previa.valorOriginal,
          valorReajustado: previa.valorReajustado,
          diferenca: previa.diferenca,
          observacao: observacao ?? null,
          criadoPorId: usuario.id,
        },
      });

      // 2) Atualiza itens do empenho com novo valor unitário
      for (const ei of empenho.itens) {
        const novoUnit = previa.novosValores.get(ei.id) ?? ei.valorUnitario;
        if (novoUnit === ei.valorUnitario) continue;
        await tx.empenhoItem.update({
          where: { id: ei.id },
          data: {
            valorUnitario: novoUnit,
            valorTotal: ei.quantidade * novoUnit,
          },
        });
      }
    });

    // 3) Recalcula comissões com o novo valor base (fora da transação
    // pra simplificar — sincronizarComissoesComEmpenhoPago é idempotente)
    await sincronizarComissoesComEmpenhoPago({
      empenhoId,
      valorBasePago: previa.valorReajustado,
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "ReajusteRetroativo",
      recursoId: empenhoId,
      resumo: `Reajuste retroativo aplicado · diferença R$ ${previa.diferenca.toFixed(2)}`,
    });

    revalidatePath(`/execucao/${empenhoId}`);
    return { ok: true };
  } catch (err) {
    console.error("[aplicarReajusteRetroativoAction]", err);
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha ao aplicar reajuste.",
    };
  }
}

/**
 * Reverte o reajuste retroativo. Deleta o registro, mas NÃO restaura
 * os valorUnitario antigos dos itens — quem desfaz precisa fazer ajuste
 * manual nos itens se quiser voltar. Decisão: cascata complexa demais
 * pra fazer automático. Avisamos no UI.
 *
 * Comum quando o usuário marca por engano e quer voltar.
 */
export async function desfazerReajusteRetroativoAction(
  empenhoId: string,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const reajuste = await prisma.reajusteRetroativo.findFirst({
    where: { empenhoId, empenho: { empresa: { contaId: usuario.contaId } } },
  });
  if (!reajuste) return { ok: false, erro: "Reajuste não encontrado." };

  // Bloqueio se o reajuste já tem NF emitida — desfazer seria perigoso
  // (NF já está no sistema da empresa). Usuário deve editar a NF manualmente.
  if (reajuste.dataNfEmitida) {
    return {
      ok: false,
      erro:
        "Não dá pra desfazer — NF complementar já foi emitida. Edite as datas/arquivos manualmente.",
    };
  }

  await prisma.reajusteRetroativo.delete({ where: { id: reajuste.id } });

  // Restaura valores originais dos empenhoItens (snapshot estava em
  // reajuste.valorOriginal, mas distribuído entre múltiplos itens —
  // como não armazenamos por-item, vamos avisar no UI que valores
  // permaneceram no valor reajustado e usuário deve ajustar manualmente)

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "ReajusteRetroativo",
    recursoId: empenhoId,
    resumo: `Reajuste retroativo desfeito · diferença R$ ${reajuste.diferenca.toFixed(2)}`,
  });

  revalidatePath(`/execucao/${empenhoId}`);
  return { ok: true };
}

const MARCO_CAMPO_DATA: Record<string, string> = {
  REAJUSTE_NF_EMITIDA: "dataNfEmitida",
  REAJUSTE_NF_ENCAMINHADA: "dataNfEncaminhada",
  REAJUSTE_PAGO: "dataPagamento",
};
const MARCO_CAMPO_ARQUIVO: Record<string, string> = {
  REAJUSTE_NF_EMITIDA: "arquivoNfEmitida",
  REAJUSTE_NF_ENCAMINHADA: "arquivoNfEncaminhada",
  REAJUSTE_PAGO: "arquivoPagamento",
};

/**
 * Marca um dos 3 marcos da NF complementar (emitida, encaminhada, pago).
 * Espelha registrarMarcoAction mas grava em ReajusteRetroativo.
 */
export async function registrarMarcoReajusteAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenhoId = String(formData.get("empenhoId") || "");
  const marco = String(formData.get("marco") || "");
  const dataIso = String(formData.get("data") || "");

  if (!MARCO_CAMPO_DATA[marco]) return { ok: false, erro: "Marco inválido." };

  const reajuste = await prisma.reajusteRetroativo.findFirst({
    where: { empenhoId, empenho: { empresa: { contaId: usuario.contaId } } },
  });
  if (!reajuste) {
    return { ok: false, erro: "Reajuste retroativo não encontrado." };
  }

  const data = dataIso ? new Date(dataIso + "T12:00:00") : new Date();
  if (isNaN(data.getTime())) return { ok: false, erro: "Data inválida." };

  const update: Record<string, Date | string> = {
    [MARCO_CAMPO_DATA[marco]]: data,
  };

  const file = formData.get("arquivo") as File | null;
  if (file && file.size > 0) {
    const salvo = await salvarArquivo(file);
    update[MARCO_CAMPO_ARQUIVO[marco]] = salvo.url;
  }

  await prisma.reajusteRetroativo.update({
    where: { id: reajuste.id },
    data: update,
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ReajusteRetroativo",
    recursoId: empenhoId,
    resumo: `Reajuste retroativo · marco ${marco}`,
  });

  revalidatePath(`/execucao/${empenhoId}`);
  return { ok: true };
}
