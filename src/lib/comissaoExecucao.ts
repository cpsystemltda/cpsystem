import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type FiltroComissao = {
  empresaId?: string; // filtra por empresa específica (lê do empenho.empresaId)
  status?: "AGUARDANDO_ORGAO" | "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";
  periodoMes?: string; // YYYY-MM — filtra por mês de dataPagamento (PAGO/PAGO_PARCIAL)
};

/**
 * Lista todas as ComissaoExecucao de um analista, com filtros opcionais.
 * Inclui o empenho + empresa pra UI mostrar Linha A.
 */
export async function listarComissoesDoAnalista(
  analistaId: string,
  filtro: FiltroComissao = {},
) {
  const where: Prisma.ComissaoExecucaoWhereInput = { analistaId };
  if (filtro.status) where.status = filtro.status;
  if (filtro.empresaId) {
    where.empenho = { empresaId: filtro.empresaId };
  }
  if (filtro.periodoMes) {
    const [ano, mes] = filtro.periodoMes.split("-").map(Number);
    if (ano && mes) {
      const inicio = new Date(ano, mes - 1, 1);
      const fim = new Date(ano, mes, 1);
      where.dataPagamento = { gte: inicio, lt: fim };
    }
  }

  return prisma.comissaoExecucao.findMany({
    where,
    include: {
      empenho: {
        select: {
          id: true,
          numero: true,
          objeto: true,
          orgaoNome: true,
          dataEmissao: true,
          status: true,
          dataPagamento: true,
          empresa: {
            select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
          },
          // Documento de origem do empenho — Ata, Contrato ou Direto
          ata: { select: { id: true, numero: true } },
          contrato: { select: { id: true, numero: true } },
        },
      },
      vinculo: { select: { percentualComissao: true } },
    },
    orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
  });
}

/**
 * Marca como ATRASADO comissões A_RECEBER cuja data prometida (dataPagamento
 * acordada — não preenchida ainda) passou de N dias. Chamada pelo cron diário.
 * Como dataPagamento só fica preenchida quando paga, usa atualizadoEm como
 * proxy para "quando foi liberada"; 30 dias é a janela padrão.
 */
export async function marcarComissoesAtrasadas(diasParaAtraso = 30): Promise<number> {
  const limite = new Date();
  limite.setDate(limite.getDate() - diasParaAtraso);

  const result = await prisma.comissaoExecucao.updateMany({
    where: {
      status: "A_RECEBER",
      atualizadoEm: { lt: limite },
    },
    data: { status: "ATRASADO" },
  });
  return result.count;
}

/**
 * Cria linhas de ComissaoExecucao (Linha B) para um empenho recém-criado.
 * Uma linha por VinculoAnalista ATIVO cuja `dataInicio` <= criação do empenho
 * (regra B2G existente: analista só comissiona o que veio depois do vínculo).
 *
 * Idempotente via @@unique(empenhoId, vinculoId) — se já existir, ignora.
 *
 * Linha A (órgão→empresa) começa como AGUARDANDO_ORGAO; só vira A_RECEBER
 * quando o empenho for marcado como PAGO ou for atualizado via
 * sincronizarComEmpenhoPago().
 */
export async function criarComissoesParaEmpenho(opts: {
  empenhoId: string;
  empresaId: string;
  valorTotalEmpenho: number;
  tx?: Prisma.TransactionClient;
}): Promise<void> {
  const client = opts.tx ?? prisma;

  const empresa = await client.empresa.findUnique({
    where: { id: opts.empresaId },
    select: { contaId: true },
  });
  if (!empresa) return;

  const vinculosAtivos = await client.vinculoAnalista.findMany({
    where: {
      contaId: empresa.contaId,
      status: "ATIVO",
    },
    select: { id: true, analistaId: true, percentualComissao: true, dataInicio: true },
  });

  const empenho = await client.empenho.findUnique({
    where: { id: opts.empenhoId },
    select: { criadoEm: true },
  });
  if (!empenho) return;

  for (const v of vinculosAtivos) {
    // Vínculo só vale pra empenhos criados após dataInicio
    if (empenho.criadoEm < v.dataInicio) continue;

    const valorCalculado = opts.valorTotalEmpenho * (v.percentualComissao / 100);

    await client.comissaoExecucao.upsert({
      where: {
        empenhoId_vinculoId: {
          empenhoId: opts.empenhoId,
          vinculoId: v.id,
        },
      },
      create: {
        empenhoId: opts.empenhoId,
        vinculoId: v.id,
        analistaId: v.analistaId,
        percentual: v.percentualComissao,
        valorBaseEmpenho: opts.valorTotalEmpenho,
        valorBasePago: 0,
        valorCalculado: 0, // só vira > 0 quando órgão pagar
        status: "AGUARDANDO_ORGAO",
      },
      update: {
        // Snapshot do valor base reflete a versão atual do empenho —
        // recalcula caso itens tenham mudado e a comissão ainda esteja em
        // AGUARDANDO_ORGAO ou A_RECEBER (mas não em PAGO, pra preservar
        // o registro contábil).
        valorBaseEmpenho: opts.valorTotalEmpenho,
        percentual: v.percentualComissao,
      },
    });
  }
}

/**
 * Sincroniza ComissaoExecucao quando o pagamento Linha A (órgão→empresa) muda.
 * - Quando empenho.status = PAGO: marca todas as comissões AGUARDANDO_ORGAO
 *   como A_RECEBER e atualiza valorBasePago + valorCalculado.
 * - NÃO altera status PAGO/PAGO_PARCIAL (já cobradas) ou ATRASADO
 *   (analista controla manualmente).
 *
 * Importante: este helper NÃO marca a Linha B como paga. Esse é o ponto
 * que corrigia o bug original.
 */
export async function sincronizarComissoesComEmpenhoPago(opts: {
  empenhoId: string;
  valorBasePago: number;
  parcial?: boolean;
}): Promise<void> {
  const comissoes = await prisma.comissaoExecucao.findMany({
    where: {
      empenhoId: opts.empenhoId,
      status: { in: ["AGUARDANDO_ORGAO", "A_RECEBER"] },
    },
  });

  for (const c of comissoes) {
    const valorCalculado = opts.valorBasePago * (c.percentual / 100);
    await prisma.comissaoExecucao.update({
      where: { id: c.id },
      data: {
        valorBasePago: opts.valorBasePago,
        valorCalculado,
        status: c.status === "AGUARDANDO_ORGAO" ? "A_RECEBER" : c.status,
      },
    });
  }
}
