"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

/**
 * Apaga TUDO exceto as contas dos super admins.
 * Mesma lógica do scripts/reset-dados.ts, mas como server action chamada da UI.
 */
export async function resetarCadastrosTeste(): Promise<{
  ok: boolean;
  apagados?: { contas: number; usuarios: number; empresas: number; analistas: number };
  erro?: string;
}> {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) {
    return { ok: false, erro: "Apenas super admins podem rodar essa operação." };
  }

  const superAdmins = await prisma.usuario.findMany({
    where: { superAdmin: true },
    select: { id: true, contaId: true },
  });
  const idsContasManter = Array.from(new Set(superAdmins.map((u) => u.contaId)));
  const idsUsuariosManter = superAdmins.map((u) => u.id);

  // Snapshot ANTES
  const antes = {
    contas: await prisma.conta.count(),
    usuarios: await prisma.usuario.count(),
    empresas: await prisma.empresa.count(),
    analistas: await prisma.analista.count(),
  };

  // 1) Empresas (cascata derruba Atas/Contratos/Empenhos)
  await prisma.empresa.deleteMany();

  // 2) Financeiro/Cobrança
  await prisma.eventoGateway.deleteMany();
  await prisma.cobranca.deleteMany();
  await prisma.metodoPagamento.deleteMany();

  // 3) Vínculos analista/empresa e comissões
  await prisma.comissao.deleteMany();
  await prisma.vinculoAnalista.deleteMany();

  // 4) Notificações in-app
  await prisma.notificacaoSistema.deleteMany();

  // 5) Auditoria
  await prisma.logAuditoria.deleteMany();

  // 6) Analistas que não são super admins
  await prisma.analista.deleteMany({
    where: { contaId: { notIn: idsContasManter } },
  });

  // 7) Todas as contas que NÃO são de super admins (cascata derruba usuários/sessões)
  await prisma.conta.deleteMany({
    where: { id: { notIn: idsContasManter } },
  });

  // 8) Mata sessões dos super admins pra forçar relogin (estado limpo)
  await prisma.sessao.deleteMany({
    where: { usuarioId: { in: idsUsuariosManter } },
  });

  // 9) Reseta contas dos super admins pra estado padrão (sem gateway, status ATIVA)
  for (const contaId of idsContasManter) {
    await prisma.conta.update({
      where: { id: contaId },
      data: {
        plano: "PREMIUM",
        statusAssinatura: "ATIVA",
        embaixadorId: null,
        gatewayProvider: null,
        gatewayCustomerId: null,
        gatewaySubscriptionId: null,
        ultimaTentativaCobranca: null,
        bloqueadoEm: null,
        trialAteEm: null,
        proximoVencimento: null,
      },
    });
  }

  const depois = {
    contas: await prisma.conta.count(),
    usuarios: await prisma.usuario.count(),
    empresas: await prisma.empresa.count(),
    analistas: await prisma.analista.count(),
  };

  revalidatePath("/admin-plataforma/reset-cadastros");

  return {
    ok: true,
    apagados: {
      contas: antes.contas - depois.contas,
      usuarios: antes.usuarios - depois.usuarios,
      empresas: antes.empresas - depois.empresas,
      analistas: antes.analistas - depois.analistas,
    },
  };
}
