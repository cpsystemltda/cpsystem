"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";

/**
 * Arquivo de clientes no admin (Regina 11/11/2026: quem não ficou como cliente
 * sai da carteira e vai para "Arquivados", dentro da própria aba Clientes).
 * Arquivar/reativar só muda a vista e o status; nenhum dado é apagado e
 * nenhuma mensagem é enviada ao cliente.
 */
export async function arquivarContaAction(contaId: string, arquivar: boolean): Promise<{ ok?: boolean; erro?: string }> {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };
  await bloquearEspionagem();
  const conta = await prisma.conta.findUnique({ where: { id: contaId }, select: { id: true, arquivadaEm: true, statusAssinatura: true, trialAteEm: true, empresas: { select: { razaoSocial: true }, take: 1 } } });
  if (!conta) return { erro: "Conta não encontrada." };
  const nome = conta.empresas[0]?.razaoSocial ?? contaId;
  if (arquivar) {
    await prisma.conta.update({ where: { id: contaId }, data: { arquivadaEm: new Date() } });
  } else {
    // Reativar devolve à carteira. O acesso do cliente segue a assinatura:
    // quem estava cancelado continua precisando assinar (ou ganhar novo teste).
    await prisma.conta.update({ where: { id: contaId }, data: { arquivadaEm: null } });
  }
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Conta", recursoId: contaId, resumo: `${arquivar ? "Arquivou" : "Reativou"} o cliente ${nome} na lista do admin` });
  revalidatePath("/admin-plataforma/clientes");
  return { ok: true };
}
