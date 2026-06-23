import "server-only";
import { prisma } from "@/lib/prisma";
import type { Plano } from "@/lib/gateway";
import { calcularBreakdown, type BreakdownCobranca } from "@/lib/precosConstants";

// Re-export pra manter caminho de import unico no lado server.
export {
  PRECO_BASE,
  PRECO_CNPJ_ADICIONAL,
  CNPJS_INCLUSOS_BASICO,
  calcularBreakdown,
} from "@/lib/precosConstants";
export type { BreakdownCobranca } from "@/lib/precosConstants";

/** Calcula o valor mensal final pra uma conta consultando o numero de CNPJs no banco. */
export async function calcularValorMensal(
  contaId: string,
  plano: Plano,
): Promise<BreakdownCobranca> {
  const numCnpjs = await prisma.empresa.count({ where: { contaId } });
  return calcularBreakdown(plano, numCnpjs);
}
