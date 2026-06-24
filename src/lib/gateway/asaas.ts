// Cliente real do gateway ASAAS.
// Docs: https://docs.asaas.com/
// Produção: https://api.asaas.com/v3
// Sandbox:  https://sandbox.asaas.com/api/v3
//
// Autenticação: header `access_token: <API_KEY>`
//
// Webhook: configure em https://www.asaas.com/customer/myAccount/notifications
// Eventos importantes:
//   PAYMENT_CREATED, PAYMENT_AWAITING_RISK_ANALYSIS,
//   PAYMENT_CONFIRMED, PAYMENT_RECEIVED,
//   PAYMENT_OVERDUE, PAYMENT_DELETED,
//   PAYMENT_REFUNDED

import type {
  GatewayPagamento,
  ClienteInput,
  CriarClienteResultado,
  CriarCobrancaInput,
  CriarCobrancaResultado,
  EventoWebhook,
  CriarAssinaturaInput,
  CriarAssinaturaResultado,
  AtualizarAssinaturaInput,
} from "./types";

type AsaasConfig = {
  apiKey: string;
  ambiente: "sandbox" | "production";
  webhookToken?: string;
};

export class GatewayAsaas implements GatewayPagamento {
  readonly nome = "ASAAS" as const;
  private readonly baseUrl: string;

  constructor(private readonly cfg: AsaasConfig) {
    this.baseUrl =
      cfg.ambiente === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        access_token: this.cfg.apiKey,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`ASAAS ${r.status}: ${txt.slice(0, 200)}`);
    }
    return (await r.json()) as T;
  }

  async criarCliente(input: ClienteInput): Promise<CriarClienteResultado> {
    type Resp = { id: string };
    const data = await this.req<Resp>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.nome,
        email: input.email,
        cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
        phone: input.telefone,
        address: input.endereco,
        externalReference: input.contaId,
      }),
    });
    return { customerId: data.id };
  }

  async criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaResultado> {
    const billingType =
      input.forma === "PIX" ? "PIX" : input.forma === "BOLETO" ? "BOLETO" : "CREDIT_CARD";

    type Resp = {
      id: string;
      status: string;
      invoiceUrl?: string;
      bankSlipUrl?: string;
    };

    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType,
      value: input.valor,
      dueDate: input.vencimento.toISOString().slice(0, 10),
      description: input.descricao,
      externalReference: input.cobrancaIdInterno,
    };

    if (input.forma === "CARTAO_CREDITO" && input.cartao) {
      body.creditCard = {
        holderName: input.cartao.nome,
        number: input.cartao.numero.replace(/\D/g, ""),
        expiryMonth: String(input.cartao.validadeMes).padStart(2, "0"),
        expiryYear: String(input.cartao.validadeAno),
        ccv: input.cartao.cvv,
      };
    }

    const r = await this.req<Resp>("/payments", { method: "POST", body: JSON.stringify(body) });

    let pixQrCode: string | undefined;
    let pixCopiaCola: string | undefined;
    if (input.forma === "PIX") {
      try {
        type PixResp = { encodedImage: string; payload: string };
        const pix = await this.req<PixResp>(`/payments/${r.id}/pixQrCode`);
        pixQrCode = `data:image/png;base64,${pix.encodedImage}`;
        pixCopiaCola = pix.payload;
      } catch {
        // ok — frontend mostra só o invoiceUrl
      }
    }

    return {
      chargeId: r.id,
      invoiceUrl: r.invoiceUrl,
      boletoUrl: r.bankSlipUrl,
      pixQrCode,
      pixCopiaCola,
      status: mapearStatusAsaas(r.status),
    };
  }

  async cancelarCobranca(chargeId: string): Promise<void> {
    await this.req(`/payments/${chargeId}`, { method: "DELETE" });
  }

  // === Subscriptions (cartão recorrente — Regina 23/06) ===
  // Asaas tokeniza o cartão internamente e cobra todo mês. Primeira cobrança
  // já vem incluída no retorno; demais virão via webhook PAYMENT_CREATED.

  async criarAssinatura(input: CriarAssinaturaInput): Promise<CriarAssinaturaResultado> {
    type SubResp = {
      id: string;
      status: string;
      nextDueDate: string;
    };
    type FirstPaymentResp = {
      data: Array<{
        id: string;
        status: string;
        invoiceUrl?: string;
      }>;
    };

    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType: "CREDIT_CARD",
      value: input.valor,
      nextDueDate: input.proximoVencimento.toISOString().slice(0, 10),
      cycle: "MONTHLY",
      description: input.descricao,
      externalReference: input.cobrancaIdInterno,
      creditCard: {
        holderName: input.cartao.nome,
        number: input.cartao.numero.replace(/\D/g, ""),
        expiryMonth: String(input.cartao.validadeMes).padStart(2, "0"),
        expiryYear: String(input.cartao.validadeAno),
        ccv: input.cartao.cvv,
      },
      creditCardHolderInfo: {
        name: input.titular.nome,
        email: input.titular.email,
        cpfCnpj: input.titular.cpfCnpj.replace(/\D/g, ""),
        phone: input.titular.telefone,
        postalCode: input.titular.cep,
        addressNumber: input.titular.numeroEndereco,
      },
    };

    const sub = await this.req<SubResp>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // Asaas gera a primeira cobrança automaticamente — busca pra retornar.
    const payments = await this.req<FirstPaymentResp>(
      `/subscriptions/${sub.id}/payments`,
    );
    const first = payments.data[0];
    if (!first) throw new Error("Asaas criou subscription mas não retornou primeira cobrança");

    return {
      subscriptionId: sub.id,
      primeiraCobranca: {
        chargeId: first.id,
        invoiceUrl: first.invoiceUrl,
        status: mapearStatusAsaas(first.status),
      },
    };
  }

  async atualizarAssinatura(input: AtualizarAssinaturaInput): Promise<void> {
    await this.req(`/subscriptions/${input.subscriptionId}`, {
      method: "POST", // Asaas usa POST pra update tb
      body: JSON.stringify({ value: input.novoValor }),
    });
  }

  async cancelarAssinatura(subscriptionId: string): Promise<void> {
    await this.req(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
  }

  async validarWebhook(headers: Headers, _rawBody: string): Promise<boolean> {
    if (!this.cfg.webhookToken) return true; // se não configurou token, aceita
    const enviado = headers.get("asaas-access-token");
    return enviado === this.cfg.webhookToken;
  }

  async parsearWebhook(rawBody: string): Promise<EventoWebhook | null> {
    try {
      const data = JSON.parse(rawBody) as {
        event?: string;
        payment?: { id?: string; status?: string; value?: number; paymentDate?: string };
      };
      if (!data.event || !data.payment?.id) return null;
      const status =
        data.payment.status === "CONFIRMED" || data.payment.status === "RECEIVED"
          ? "PAGA"
          : data.payment.status === "OVERDUE"
            ? "ATRASADA"
            : data.payment.status === "REFUNDED"
              ? "ESTORNADA"
              : data.payment.status === "DELETED"
                ? "CANCELADA"
                : undefined;
      return {
        evento: data.event,
        chargeId: data.payment.id,
        status,
        valorPago: data.payment.value,
        pagaEm: data.payment.paymentDate ? new Date(data.payment.paymentDate) : undefined,
      };
    } catch {
      return null;
    }
  }
}

function mapearStatusAsaas(s: string): CriarCobrancaResultado["status"] {
  switch (s) {
    case "CONFIRMED":
    case "RECEIVED":
      return "PAGA";
    case "OVERDUE":
      return "ATRASADA";
    case "DELETED":
    case "REFUNDED":
      return "CANCELADA";
    default:
      return "PENDENTE";
  }
}
