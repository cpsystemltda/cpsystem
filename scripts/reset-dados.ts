/**
 * RESET de dados — apaga TUDO exceto as contas dos super admins.
 *
 * Mantém:
 *  - Conta + Usuario do(s) super admin(s) (superAdmin = true)
 *
 * Apaga (incluindo cascata):
 *  - Empresas (e suas Atas, Contratos, Empenhos, itens, parcelas, endereços, pontos focais, garantias, anexos…)
 *  - Cobranças, EventoGateway, MetodoPagamento
 *  - LogAuditoria
 *  - Notificações
 *  - VinculoAnalista, Comissoes
 *  - Sessões (força logout)
 *  - Contas que não são de super admins (analistas, clientes, etc.)
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

async function main() {
  const p = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // Identifica super admins (NÃO serão apagados)
  const superAdmins = await p.usuario.findMany({
    where: { superAdmin: true },
    select: { id: true, contaId: true, email: true, nome: true },
  });
  const idsContasManter = Array.from(new Set(superAdmins.map((u) => u.contaId)));
  console.log("Super admins preservados:");
  for (const u of superAdmins) console.log(`  - ${u.email} (${u.nome})`);
  console.log(`Contas mantidas: ${idsContasManter.length}`);

  // Snapshot de contagens antes
  const antes = {
    contas: await p.conta.count(),
    usuarios: await p.usuario.count(),
    empresas: await p.empresa.count(),
    atas: await p.ata.count(),
    contratos: await p.contrato.count(),
    empenhos: await p.empenho.count(),
    cobrancas: await p.cobranca.count(),
    notificacoes: await p.notificacao.count(),
    auditoria: await p.logAuditoria.count(),
  };
  console.log("\nAntes do reset:", antes);

  // 1. Apaga TODAS as Empresas (cascata derruba Atas/Contratos/Empenhos)
  await p.empresa.deleteMany();

  // 2. Apaga registros financeiros e de cobrança
  await p.eventoGateway.deleteMany();
  await p.cobranca.deleteMany();
  await p.metodoPagamento.deleteMany();

  // 3. Apaga vínculos analista/empresa e comissões
  await p.comissao.deleteMany();
  await p.vinculoAnalista.deleteMany();

  // 4. Apaga notificações de sistema (in-app) e operacionais
  await p.notificacaoSistema.deleteMany();

  // 5. Apaga auditoria
  await p.logAuditoria.deleteMany();

  // 6. Apaga Analistas (que não são super admins) e suas contas
  // Analistas têm Conta própria (tipo ANALISTA) — apagar essas contas (não são super admins)
  await p.analista.deleteMany({
    where: { contaId: { notIn: idsContasManter } },
  });

  // 7. Apaga TODAS as contas que NÃO são de super admins (cascata derruba usuários/sessões dessas contas)
  await p.conta.deleteMany({
    where: { id: { notIn: idsContasManter } },
  });

  // 8. Apaga sessões dos super admins pra forçar relogin com estado limpo
  await p.sessao.deleteMany({
    where: { usuarioId: { in: superAdmins.map((u) => u.id) } },
  });

  // 9. Reseta a Conta dos super admins pra estado de TRIAL (limpa cookies de gateway, etc.)
  for (const contaId of idsContasManter) {
    await p.conta.update({
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

  // Snapshot depois
  const depois = {
    contas: await p.conta.count(),
    usuarios: await p.usuario.count(),
    empresas: await p.empresa.count(),
    atas: await p.ata.count(),
    contratos: await p.contrato.count(),
    empenhos: await p.empenho.count(),
    cobrancas: await p.cobranca.count(),
    notificacoes: await p.notificacao.count(),
    auditoria: await p.logAuditoria.count(),
  };
  console.log("\nDepois do reset:", depois);
  console.log("\n✅ Reset concluído. Os super admins precisarão fazer login novamente.");

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
