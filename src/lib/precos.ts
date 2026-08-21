import "server-only";
import { prisma } from "@/lib/prisma";
import type { Plano } from "@/lib/gateway";
import { calcularBreakdown, type BreakdownCobranca } from "@/lib/precosConstants";

// Re-export pra manter caminho de import unico no lado server.
export {
  PRECO_BASE,
  PRECO_CNPJ_ADICIONAL,
  CNPJS_INCLUSOS_BASICO,
  COLABORADORES_INCLUSOS,
  PRECO_COLABORADOR_ADICIONAL,
  calcularBreakdown,
} from "@/lib/precosConstants";
export type { BreakdownCobranca } from "@/lib/precosConstants";

/**
 * Valor mensal final da conta: plano + CNPJ adicional + colaborador adicional.
 *
 * Colaborador = usuário da conta menos o titular. O titular nunca conta, senão
 * toda conta nasceria devendo por existir. Regina 21/08: 2 inclusos, R$ 10,90
 * por cabeça a partir do 3º.
 */
export async function calcularValorMensal(
  contaId: string,
  plano: Plano,
): Promise<BreakdownCobranca> {
  const [numCnpjs, numUsuarios] = await Promise.all([
    prisma.empresa.count({ where: { contaId } }),
    prisma.usuario.count({ where: { contaId } }),
  ]);
  return calcularBreakdown(plano, numCnpjs, Math.max(0, numUsuarios - 1));
}
