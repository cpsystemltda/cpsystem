import "server-only";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { garantirCustomer } from "@/app/actions/assinatura";
import { calcularValorMensal } from "@/lib/precos";
import { sincronizarCobranca } from "@/lib/googleCalendar";

/**
 * Renovação automática mensal — Regina 23/06.
 *
 * Procura contas ATIVAS com `proximoVencimento` <= hoje+3 dias.
 * Pra cada uma, se NÃO houver cobrança pendente/paga pra a competência
 * do próximo vencimento, cria uma nova cobrança PIX no Asaas usando
 * o valor calculado dinamicamente (BASICO + R$ 39,90 por CNPJ adicional).
 *
 * Quando o cliente paga, o webhook chama `processarEventoGateway` que
 * chama `ativarPlano` → move `proximoVencimento` +1 mês.
 *
 * Idempotente: chamada multiplas vezes no mesmo dia não cria duplicata.
 *
 * NOTA sobre cartão: na renovação não tentamos cobrar cartão automaticamente
 * porque não temos o cartão tokenizado (PCI-DSS). O cliente recebe a fatura
 * via email do Asaas e paga via PIX/boleto/link do cartão. Pra tokenização
 * verdadeira (cobrança 100% automática no cartão salvo), precisaríamos
 * migrar pra Subscription do Asaas — escopo futuro.
 */
export async function gerarRenovacoesMensais(): Promise<{
  geradas: number;
  ignoradas: number;
  erros: number;
}> {
  const hoje = new Date();
  const em3dias = new Date(hoje.getTime() + 3 * 86400000);

  // Pula contas com gatewaySubscriptionId — Asaas já gera cobranças
  // automaticamente pra elas (cartão recorrente). Regina 23/06.
  const aRenovar = await prisma.conta.findMany({
    where: {
      statusAssinatura: "ATIVA",
      proximoVencimento: { lte: em3dias },
      gatewaySubscriptionId: null,
    },
    select: { id: true, plano: true, proximoVencimento: true },
  });

  let geradas = 0;
  let ignoradas = 0;
  let erros = 0;

  for (const conta of aRenovar) {
    if (!conta.proximoVencimento) {
      ignoradas++;
      continue;
    }

    const vencimento = conta.proximoVencimento;
    const competencia = `${vencimento.getFullYear()}-${String(vencimento.getMonth() + 1).padStart(2, "0")}`;

    // Idempotência: já existe cobrança pra essa competência?
    const jaExiste = await prisma.cobranca.findFirst({
      where: {
        contaId: conta.id,
        competencia,
        status: { in: ["PENDENTE", "PROCESSANDO", "PAGA"] },
      },
      select: { id: true },
    });
    if (jaExiste) {
      ignoradas++;
      continue;
    }

    try {
      const breakdown = await calcularValorMensal(conta.id, conta.plano);
      const { customerId } = await garantirCustomer(conta.id);

      const cobranca = await prisma.cobranca.create({
        data: {
          contaId: conta.id,
          competencia,
          plano: conta.plano,
          forma: "PIX",
          valor: breakdown.valorTotal,
          status: "PENDENTE",
          vencimento,
          observacoes:
            breakdown.cnpjsAdicionais > 0
              ? `Renovação automática · ${breakdown.numCnpjs} CNPJs (${breakdown.cnpjsAdicionais} adicional)`
              : "Renovação automática mensal",
        },
      });

      const gateway = await getGateway();
      const r = await gateway.criarCobranca({
        cobrancaIdInterno: cobranca.id,
        customerId,
        valor: breakdown.valorTotal,
        vencimento,
        descricao:
          breakdown.cnpjsAdicionais > 0
            ? `CP System — ${conta.plano} (${competencia}) · ${breakdown.numCnpjs} CNPJs`
            : `CP System — ${conta.plano} (${competencia})`,
        forma: "PIX",
      });

      await prisma.cobranca.update({
        where: { id: cobranca.id },
        data: {
          gatewayChargeId: r.chargeId,
          gatewayInvoiceUrl: r.invoiceUrl,
          pixQrCode: r.pixQrCode,
          pixCopiaCola: r.pixCopiaCola,
        },
      });

      await prisma.eventoGateway.create({
        data: {
          cobrancaId: cobranca.id,
          provider: gateway.nome,
          evento: "RENOVACAO_GERADA",
          payload: JSON.stringify({
            competencia,
            valor: breakdown.valorTotal,
            cnpjs: breakdown.numCnpjs,
            adicional: breakdown.valorAdicional,
            geradaEm: hoje.toISOString(),
          }),
        },
      });

      // Sync Google Calendar (Regina 23/07 — best-effort).
      // Vai pro Google do primeiro admin da conta que tenha conectado.
      await sincronizarCobranca(cobranca.id, "upsert");

      geradas++;
    } catch (e) {
      erros++;
      console.error(`Erro renovando conta ${conta.id}:`, e);
    }
  }

  return { geradas, ignoradas, erros };
}
