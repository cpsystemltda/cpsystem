"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { getGateway } from "@/lib/gateway";
import { traduzirErroGateway } from "@/lib/pagamentoAnalista";

/**
 * Traz pro banco as mensalidades que a assinatura gerou no gateway.
 *
 * Regina 24/08, olhando a conta do Léo: "ele não pagou esse mês e está como se
 * estivesse adimplente". A causa não era a tela — era que a assinatura de cartão
 * cobra sozinha no gateway, e o webhook, ao não encontrar a cobrança aqui,
 * desistia calado. Só a primeira mensalidade (criada por nós) existia no banco;
 * as seguintes eram invisíveis: não apareciam no histórico do cliente, não
 * contavam receita e não moviam o ciclo.
 *
 * O webhook já foi corrigido pra criar o que falta. Esta ação recupera o
 * passado — e serve de conferência sempre que a dúvida for "o gateway cobrou?".
 */
export type ResultadoSync = {
  ok?: true;
  erro?: string;
  resumo?: { importadas: number; atualizadas: number; total: number };
};

export async function sincronizarAssinaturaAction(
  _prev: ResultadoSync | null,
  formData: FormData,
): Promise<ResultadoSync> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };

  const contaId = String(formData.get("contaId") || "").trim();
  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      id: true,
      plano: true,
      diaVencimento: true,
      gatewaySubscriptionId: true,
      empresas: { select: { razaoSocial: true }, take: 1 },
    },
  });
  if (!conta) return { erro: "Conta não encontrada." };
  if (!conta.gatewaySubscriptionId) return { erro: "Esta conta não tem assinatura no gateway." };

  const gateway = await getGateway();
  if (!gateway.listarCobrancasDaAssinatura) {
    return { erro: "Gateway não sabe listar cobranças de assinatura." };
  }

  try {
    const doGateway = await gateway.listarCobrancasDaAssinatura(conta.gatewaySubscriptionId);
    let importadas = 0;
    let atualizadas = 0;

    for (const c of doGateway) {
      const existente = await prisma.cobranca.findFirst({
        where: { gatewayChargeId: c.chargeId },
        select: { id: true, status: true, pagaEm: true },
      });
      const competencia = `${c.vencimento.getFullYear()}-${String(c.vencimento.getMonth() + 1).padStart(2, "0")}`;

      if (!existente) {
        await prisma.cobranca.create({
          data: {
            contaId: conta.id,
            competencia,
            plano: conta.plano,
            forma: c.forma,
            valor: c.valor,
            vencimento: c.vencimento,
            status: c.status,
            pagaEm: c.pagaEm,
            gatewayChargeId: c.chargeId,
            gatewayInvoiceUrl: c.invoiceUrl ?? null,
            observacoes: "Importada do gateway (assinatura)",
          },
        });
        importadas++;
      } else if (existente.status !== c.status || (!existente.pagaEm && c.pagaEm)) {
        await prisma.cobranca.update({
          where: { id: existente.id },
          data: { status: c.status, pagaEm: c.pagaEm ?? existente.pagaEm },
        });
        atualizadas++;
      }
    }

    // Recoloca o ciclo no lugar: próximo vencimento = mês seguinte ao da última
    // mensalidade paga, no dia escolhido pelo cliente quando houver.
    const ultimaPaga = [...doGateway]
      .filter((c) => c.status === "PAGA")
      .sort((a, b) => b.vencimento.getTime() - a.vencimento.getTime())[0];
    if (ultimaPaga) {
      const prox = new Date(
        ultimaPaga.vencimento.getFullYear(),
        ultimaPaga.vencimento.getMonth() + 1,
        conta.diaVencimento ?? ultimaPaga.vencimento.getDate(),
      );
      await prisma.conta.update({ where: { id: conta.id }, data: { proximoVencimento: prox } });
    }

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Conta",
      recursoId: conta.id,
      resumo: `Sincronizou assinatura do gateway de ${conta.empresas[0]?.razaoSocial ?? conta.id}: ${importadas} cobrança(s) importada(s), ${atualizadas} atualizada(s)`,
    });

    revalidatePath("/admin/gateway");
    revalidatePath("/conta/assinatura");
    return { ok: true, resumo: { importadas, atualizadas, total: doGateway.length } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-assinatura] falhou:", err);
    return { erro: traduzirErroGateway(msg) };
  }
}
