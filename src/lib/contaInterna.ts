import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Conta interna do CP System (Regina 24/08).
 *
 * As contas da Regina e do Igor existem pra OPERAR a plataforma, não pra
 * consumi-la: elas nunca assinaram nada e não podem gerar cobrança. O sinal é
 * ter usuário `superAdmin` — o mesmo já usado pra tirá-las do faturamento em
 * /admin-plataforma.
 *
 * Isso não era filtrado na renovação automática, e em 24/08 o cron abriu uma
 * cobrança de R$ 997 (PIX, criada no Asaas) contra a própria conta da Regina.
 * A conta tinha `proximoVencimento` preenchido desde os testes de integração de
 * junho/julho — cobranças de R$ 10 que, ao serem pagas, deixaram a conta como
 * assinante ativa. Daí em diante o cron passou a tratá-la como cliente.
 */

/** Filtro Prisma: contas que PODEM ser cobradas (exclui as internas). */
export const CONTAS_COBRAVEIS = { usuarios: { none: { superAdmin: true } } } as const;

/** Mesmo filtro, para consultas que partem da Cobranca. */
export const COBRANCAS_DE_CLIENTE = { conta: CONTAS_COBRAVEIS } as const;

export async function ehContaInterna(contaId: string): Promise<boolean> {
  const n = await prisma.usuario.count({ where: { contaId, superAdmin: true } });
  return n > 0;
}
