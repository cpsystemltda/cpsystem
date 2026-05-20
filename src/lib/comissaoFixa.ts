import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type FiltroFixo = {
  vinculoId?: string;
  status?: "A_RECEBER" | "ATRASADO" | "PAGO" | "PAGO_PARCIAL";
  periodo?: string; // YYYY-MM
};

/**
 * Calcula o vencimento da comissão fixa para uma competência.
 * Usa o dia do vínculo (default 5) e clamp pro último dia do mês quando o dia
 * combinado não existe (ex: dia 31 em fevereiro).
 */
function calcularVencimento(competencia: string, diaVencimento: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dia = Math.min(diaVencimento || 5, ultimoDia);
  return new Date(ano, mes - 1, dia);
}

function competenciaDoMes(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Gera as linhas de PagamentoFixoMensal para o mês corrente, uma por vínculo
 * ATIVO sem fixo zerado. Idempotente via @@unique(vinculoId, competencia).
 * Retorna quantas linhas foram criadas.
 *
 * Chamado pelo cron diário — na virada do mês, a primeira execução cria as
 * linhas de todos os vínculos ativos.
 */
export async function gerarLinhasComissaoFixaDoMes(
  competencia = competenciaDoMes(),
): Promise<number> {
  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { status: "ATIVO", fixoMensal: { gt: 0 } },
    select: { id: true, fixoMensal: true, diaVencimentoFixo: true },
  });
  return criarLinhasParaVinculos(vinculos, competencia);
}

/**
 * Versão focada num analista — usada pelo painel quando ele carrega, pra
 * garantir que as linhas do mês corrente existem mesmo se o cron diário
 * ainda não passou. Mais barata que `gerarLinhasComissaoFixaDoMes()` porque
 * filtra pelo analista; idempotente via @@unique.
 */
export async function gerarLinhasComissaoFixaDoAnalista(
  analistaId: string,
  competencia = competenciaDoMes(),
): Promise<number> {
  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { analistaId, status: "ATIVO", fixoMensal: { gt: 0 } },
    select: { id: true, fixoMensal: true, diaVencimentoFixo: true },
  });
  return criarLinhasParaVinculos(vinculos, competencia);
}

async function criarLinhasParaVinculos(
  vinculos: { id: string; fixoMensal: number; diaVencimentoFixo: number }[],
  competencia: string,
): Promise<number> {
  let criadas = 0;
  for (const v of vinculos) {
    const vencimento = calcularVencimento(competencia, v.diaVencimentoFixo);
    try {
      await prisma.pagamentoFixoMensal.create({
        data: {
          vinculoId: v.id,
          competencia,
          valor: v.fixoMensal,
          vencimento,
          status: "A_RECEBER",
        },
      });
      criadas++;
    } catch (err) {
      // Unique violation = já existia. Ignora.
      if ((err as { code?: string })?.code !== "P2002") throw err;
    }
  }
  return criadas;
}

/**
 * Promove A_RECEBER → ATRASADO quando o vencimento já passou.
 */
export async function marcarFixosAtrasados(): Promise<number> {
  const hoje = new Date();
  const result = await prisma.pagamentoFixoMensal.updateMany({
    where: {
      status: "A_RECEBER",
      vencimento: { lt: hoje },
    },
    data: { status: "ATRASADO" },
  });
  return result.count;
}

/**
 * Lista as comissões fixas de um analista (todos os vínculos), com filtros.
 * Inclui a conta/empresa pra UI mostrar nome.
 */
export async function listarComissoesFixasDoAnalista(
  analistaId: string,
  filtro: FiltroFixo = {},
) {
  const where: Prisma.PagamentoFixoMensalWhereInput = {
    vinculo: { analistaId },
  };
  if (filtro.vinculoId) where.vinculoId = filtro.vinculoId;
  if (filtro.status) where.status = filtro.status;
  if (filtro.periodo) where.competencia = filtro.periodo;

  return prisma.pagamentoFixoMensal.findMany({
    where,
    include: {
      vinculo: {
        select: {
          id: true,
          percentualComissao: true,
          fixoMensal: true,
          diaVencimentoFixo: true,
          status: true,
          conta: {
            select: {
              empresas: {
                select: { id: true, razaoSocial: true, nomeFantasia: true },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: [{ competencia: "desc" }, { vencimento: "asc" }],
  });
}
