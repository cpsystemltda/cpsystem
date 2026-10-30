import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Quem é "equipe do CP System" para as telas de uso interno — prospecção e
 * follow-up de clientes.
 *
 * Regina 08/09: a closer entra com o login do próprio CP System, cadastrada
 * como colaboradora da conta interna só com o módulo "Prospecção" marcado, e
 * também usa a conta de demonstração. A mesma regra vale para o follow-up:
 * quem trabalha a carteira é a mesma equipe. Centralizado aqui porque a
 * regra morava copiada em dois lugares e ia ganhar o terceiro.
 */
export async function temAcessoInterno(usuario: {
  contaId: string;
  email: string;
  superAdmin: boolean;
  acessoRestrito: boolean;
  modulosPermitidos: string[];
}): Promise<boolean> {
  if (usuario.superAdmin) return true;
  if (usuario.email === "demonstracao@cpsystem.app.br") return true;

  const contaInterna = await prisma.conta.findFirst({
    where: { id: usuario.contaId, usuarios: { some: { superAdmin: true } } },
    select: { id: true },
  });
  return (
    !!contaInterna &&
    (!usuario.acessoRestrito || usuario.modulosPermitidos.includes("PROSPECCAO"))
  );
}
