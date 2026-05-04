// Gateway DEMO: simula sucesso de pagamento sem cobrar nada de verdade.
// Use enquanto não tiver credencial do ASAAS/Stripe configurada.

import { randomBytes } from "node:crypto";
import type {
  GatewayPagamento,
  ClienteInput,
  CriarClienteResultado,
  CriarCobrancaInput,
  CriarCobrancaResultado,
  EventoWebhook,
} from "./types";

export class GatewayDemo implements GatewayPagamento {
  readonly nome = "DEMO" as const;

  async criarCliente(input: ClienteInput): Promise<CriarClienteResultado> {
    return { customerId: `demo_cust_${input.contaId.slice(0, 8)}` };
  }

  async criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaResultado> {
    const chargeId = `demo_pay_${randomBytes(8).toString("hex")}`;

    if (input.forma === "PIX") {
      return {
        chargeId,
        pixCopiaCola: `00020126360014BR.GOV.BCB.PIX0114DEMO${randomBytes(4).toString("hex").toUpperCase()}5204000053039865802BR5917CP SYSTEM DEMO6009BRASILIA62${randomBytes(4).toString("hex")}6304ABCD`,
        pixQrCode: gerarPlaceholderQrBase64(),
        invoiceUrl: `/api/anexos/demo-fatura.pdf`,
        status: "PENDENTE",
      };
    }
    if (input.forma === "BOLETO") {
      return {
        chargeId,
        boletoUrl: `https://demo.cp-system/boleto/${chargeId}`,
        invoiceUrl: `https://demo.cp-system/boleto/${chargeId}`,
        status: "PENDENTE",
      };
    }
    // Cartão de crédito — em demo, considera aprovado se cvv !== "000"
    if (input.cartao?.cvv === "000") {
      return { chargeId, status: "ATRASADA" }; // simula recusa
    }
    return { chargeId, status: "PAGA" };
  }

  async cancelarCobranca(_chargeId: string): Promise<void> {
    // no-op
  }

  async validarWebhook(_headers: Headers, _rawBody: string): Promise<boolean> {
    return true; // demo aceita qualquer webhook
  }

  async parsearWebhook(rawBody: string): Promise<EventoWebhook | null> {
    try {
      const data = JSON.parse(rawBody) as { evento?: string; chargeId?: string; status?: string; valorPago?: number };
      if (!data.evento || !data.chargeId) return null;
      return {
        evento: data.evento,
        chargeId: data.chargeId,
        status: data.status as EventoWebhook["status"],
        valorPago: data.valorPago,
        pagaEm: data.status === "PAGA" ? new Date() : undefined,
      };
    } catch {
      return null;
    }
  }
}

// QR placeholder (PNG 1x1 transparente em base64) só pra ter algo no <img>
function gerarPlaceholderQrBase64() {
  return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjEwMCIgeT0iMTA1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjMzMzIj5RUiBQSVggKGRlbW8pPC90ZXh0Pjwvc3ZnPg==";
}
