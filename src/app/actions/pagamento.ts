"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { getGateway } from "@/lib/gateway";
import { garantirCustomer } from "@/app/actions/assinatura";

/**
 * PIX de uma cobrança que já existe (Regina 24/08).
 *
 * O sistema sempre soube gerar PIX, mas o código morria no banco: nenhuma tela
 * do cliente mostrava QR nem copia-e-cola, e quem tinha fatura em aberto só
 * conseguia pagar saindo pro site do Asaas. Esta action é o que a tela chama
 * pra trazer o PIX pra dentro do sistema.
 *
 * Ela resolve os três estados em que uma cobrança pode estar:
 *  1. já tem o PIX guardado → devolve na hora;
 *  2. existe no Asaas mas sem PIX (ou como cartão/boleto) → troca a forma se
 *     precisar e busca o código;
 *  3. nunca chegou a ser criada no Asaas → cria agora, como PIX.
 *
 * Se ainda assim não vier código, o erro vai pro log com o motivo real e o
 * cliente recebe um recado curto + o link da fatura. Silêncio aqui foi o que
 * deixou o Léo sem conseguir pagar sem ninguém ficar sabendo.
 */

export type ResultadoPix =
  | { ok: true; qrCodeBase64: string | null; copiaCola: string; invoiceUrl: string | null }
  | { ok: false; erro: string; invoiceUrl: string | null };

const STATUS_PAGAVEL = ["PENDENTE", "PROCESSANDO", "ATRASADA"] as const;

export async function obterPixDaCobrancaAction(cobrancaId: string): Promise<ResultadoPix> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const cobranca = await prisma.cobranca.findFirst({
    where: { id: cobrancaId, contaId: usuario.contaId },
  });
  if (!cobranca) return { ok: false, erro: "Cobrança não encontrada.", invoiceUrl: null };

  if (cobranca.status === "PAGA") {
    return { ok: false, erro: "Esta cobrança já está paga.", invoiceUrl: cobranca.gatewayInvoiceUrl };
  }
  if (!(STATUS_PAGAVEL as readonly string[]).includes(cobranca.status)) {
    return {
      ok: false,
      erro: "Esta cobrança não está aberta para pagamento.",
      invoiceUrl: cobranca.gatewayInvoiceUrl,
    };
  }

  // 1. Já temos o código guardado.
  if (cobranca.pixCopiaCola) {
    return {
      ok: true,
      qrCodeBase64: cobranca.pixQrCode,
      copiaCola: cobranca.pixCopiaCola,
      invoiceUrl: cobranca.gatewayInvoiceUrl,
    };
  }

  const gateway = await getGateway();

  try {
    // 3. Cobrança que nunca chegou ao gateway (falha na criação, por exemplo).
    if (!cobranca.gatewayChargeId) {
      const { customerId } = await garantirCustomer(usuario.contaId);
      const criada = await gateway.criarCobranca({
        customerId,
        cobrancaIdInterno: cobranca.id,
        valor: cobranca.valor,
        vencimento: cobranca.vencimento,
        forma: "PIX",
        descricao: `CP System — Plano ${cobranca.plano} (${cobranca.competencia})`,
      });
      const atualizada = await prisma.cobranca.update({
        where: { id: cobranca.id },
        data: {
          forma: "PIX",
          gatewayChargeId: criada.chargeId,
          gatewayInvoiceUrl: criada.invoiceUrl ?? null,
          pixQrCode: criada.pixQrCode ?? null,
          pixCopiaCola: criada.pixCopiaCola ?? null,
        },
      });
      if (!atualizada.pixCopiaCola) {
        throw new Error("gateway criou a cobrança mas não devolveu o código PIX");
      }
      revalidatePath("/conta/assinatura");
      return {
        ok: true,
        qrCodeBase64: atualizada.pixQrCode,
        copiaCola: atualizada.pixCopiaCola,
        invoiceUrl: atualizada.gatewayInvoiceUrl,
      };
    }

    // 2. Existe no gateway. Cartão não tem PIX — troca a forma antes de pedir.
    if (cobranca.forma === "CARTAO_CREDITO" && gateway.trocarFormaCobranca) {
      await gateway.trocarFormaCobranca(cobranca.gatewayChargeId, "PIX");
    }

    if (!gateway.obterPix) {
      throw new Error(`gateway ${gateway.nome} não sabe buscar PIX`);
    }
    const pix = await gateway.obterPix(cobranca.gatewayChargeId);

    const atualizada = await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        forma: "PIX",
        pixQrCode: pix.qrCodeBase64,
        pixCopiaCola: pix.copiaCola,
      },
    });

    revalidatePath("/conta/assinatura");
    return {
      ok: true,
      qrCodeBase64: atualizada.pixQrCode,
      copiaCola: pix.copiaCola,
      invoiceUrl: atualizada.gatewayInvoiceUrl,
    };
  } catch (err) {
    // O motivo real (chave PIX ausente na conta do gateway, cobrança vencida
    // lá, credencial errada) fica aqui pra quem cuida da plataforma.
    console.error(`[pix] falha ao obter PIX da cobranca ${cobranca.id}:`, err);
    return {
      ok: false,
      erro: "Não consegui gerar o código PIX agora. Tente de novo em instantes.",
      invoiceUrl: cobranca.gatewayInvoiceUrl,
    };
  }
}
