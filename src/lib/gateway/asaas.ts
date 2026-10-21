import { asaasBaseUrl } from "@/lib/asaas-env";

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
  FormaPagamento,
  PixParaPagar,
  ConfigNotaFiscal,
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
      asaasBaseUrl(cfg.ambiente);
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    // Content-Type so quando ha corpo. A Asaas documenta que "chamadas GET
    // devem ser enviadas com body vazio" e responde 403 quando o request
    // aparenta ter corpo — foi assim que o GET do QR PIX vinha falhando.
    const temCorpo = init.body !== undefined && init.body !== null;
    const r = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        access_token: this.cfg.apiKey,
        ...(temCorpo ? { "Content-Type": "application/json" } : {}),
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
    // NFSe exige endereco estruturado batendo com ViaCEP. Regina 17/07:
    // buscamos os campos oficiais no ViaCEP com o CEP e usamos como fonte
    // canonica (address=logradouro, province=bairro). O texto livre que o
    // cliente digitou (input.endereco) vai pra complement porque geralmente
    // contem "Sala X, Bloco Y" ou similares que a prefeitura rejeita se
    // vier no address.
    const cepLimpo = input.cep?.replace(/\D/g, "");
    let addressCanonico = input.endereco;
    let provinceCanonica = input.bairro;
    let complementoFinal = input.complemento || input.endereco;
    if (cepLimpo && cepLimpo.length === 8) {
      try {
        const via = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`).then((r) => r.json());
        if (via && !via.erro && via.logradouro) {
          addressCanonico = via.logradouro;
          provinceCanonica = via.bairro || provinceCanonica;
          // Se input.endereco eh diferente do logradouro oficial, coloca ele em complement
          if (input.endereco && input.endereco !== via.logradouro && !complementoFinal?.includes(input.endereco)) {
            complementoFinal = [complementoFinal, input.endereco].filter(Boolean).join(" - ");
          }
        }
      } catch {
        // Se ViaCEP falhar, cai no que veio do input mesmo
      }
    }
    const data = await this.req<Resp>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.nome,
        email: input.email,
        cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
        phone: input.telefone,
        address: addressCanonico,
        addressNumber: input.addressNumber ?? "S/N",
        complement: complementoFinal,
        province: provinceCanonica,
        postalCode: cepLimpo,
        state: input.estado,
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
        const pix = await this.obterPix(r.id);
        pixQrCode = pix.qrCodeBase64;
        pixCopiaCola = pix.copiaCola;
      } catch (e) {
        // Antes esse catch era vazio: o PIX sumia sem deixar rastro, e o
        // cliente ficava sem como pagar sem ninguem saber. Agora fica no log
        // (a cobranca continua valendo — a tela oferece "gerar de novo").
        console.error(`[asaas] cobranca ${r.id} criada mas sem QR PIX:`, e);
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

  /**
   * QR + copia-e-cola de uma cobranca existente.
   * Docs: GET /v3/payments/{id}/pixQrCode. Vale pra billingType PIX, BOLETO e
   * UNDEFINED — cobranca de cartao nao tem PIX, por isso a troca de forma
   * existe logo abaixo.
   */
  async obterPix(chargeId: string): Promise<PixParaPagar> {
    type PixResp = { encodedImage: string; payload: string; expirationDate?: string };
    const pix = await this.req<PixResp>(`/payments/${chargeId}/pixQrCode`);
    if (!pix.payload) throw new Error("Asaas não devolveu o código PIX desta cobrança.");
    return {
      qrCodeBase64: `data:image/png;base64,${pix.encodedImage}`,
      copiaCola: pix.payload,
      expiraEm: pix.expirationDate ? new Date(pix.expirationDate) : undefined,
    };
  }

  /** PUT /v3/payments/{id} — so aceito enquanto a cobranca esta em aberto. */
  async trocarFormaCobranca(chargeId: string, forma: FormaPagamento): Promise<void> {
    const billingType =
      forma === "PIX" ? "PIX" : forma === "BOLETO" ? "BOLETO" : "CREDIT_CARD";
    await this.req(`/payments/${chargeId}`, {
      method: "PUT",
      body: JSON.stringify({ billingType }),
    });
  }

  /**
   * GET /v3/payments/{id} — `creditDate` sai preenchido quando o valor ja foi
   * liberado; ate la vale `estimatedCreditDate`.
   */
  async consultarCredito(chargeId: string): Promise<{ creditadoEm: Date | null; previsaoCredito: Date | null }> {
    type Resp = { creditDate?: string | null; estimatedCreditDate?: string | null };
    const p = await this.req<Resp>(`/payments/${chargeId}`);
    return {
      creditadoEm: p.creditDate ? new Date(p.creditDate) : null,
      previsaoCredito: p.estimatedCreditDate ? new Date(p.estimatedCreditDate) : null,
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
      // O Asaas devolve o cartão tokenizado AQUI, e só aqui — é a única chance
      // de guardar o token (Regina 21/09/2026).
      creditCard?: {
        creditCardNumber?: string;
        creditCardBrand?: string;
        creditCardToken?: string;
      };
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
      // Guardar o token é o que permite RECOLOCAR o cartão na assinatura sem
      // pedir o número ao cliente de novo.
      //
      // Caso Léo, 21/09/2026: a assinatura dele cobrou no cartão em julho e
      // depois ficou SEM cartão — as cobranças de setembro e outubro nasceram
      // `billingType: CREDIT_CARD` com `creditCard: null` e apenas
      // acumularam como PENDING, sem ninguém perceber. Como o token nunca foi
      // guardado, não havia como religar a recorrência: só pedindo o cartão
      // outra vez a um cliente que já tinha cadastrado.
      creditCardToken: sub.creditCard?.creditCardToken,
      primeiraCobranca: {
        chargeId: first.id,
        invoiceUrl: first.invoiceUrl,
        status: mapearStatusAsaas(first.status),
      },
    };
  }

  /**
   * A configuração de emissão automática que a assinatura já tem, se tiver.
   *
   * Serve de molde: a primeira assinatura é configurada no painel do Asaas,
   * por quem conhece os dados fiscais da empresa, e as próximas copiam dali.
   * Assim nenhuma alíquota mora no nosso código.
   */
  async lerConfigNotaFiscal(subscriptionId: string): Promise<ConfigNotaFiscal | null> {
    try {
      const r = await this.req<Record<string, unknown>>(
        `/subscriptions/${subscriptionId}/invoiceSettings`,
      );
      if (!r || typeof r !== "object") return null;
      const t = (r["taxes"] ?? {}) as Record<string, unknown>;
      return {
        municipalServiceId: (r["municipalServiceId"] as string) ?? null,
        municipalServiceCode: (r["municipalServiceCode"] as string) ?? null,
        municipalServiceName: (r["municipalServiceName"] as string) ?? null,
        deductions: Number(r["deductions"] ?? 0),
        effectiveDatePeriod: (r["effectiveDatePeriod"] as string) ?? "ON_PAYMENT_CONFIRMATION",
        receivedOnly: Boolean(r["receivedOnly"] ?? false),
        daysBeforeDueDate: (r["daysBeforeDueDate"] as number) ?? null,
        observations: (r["observations"] as string) ?? null,
        taxes: {
          retainIss: Boolean(t["retainIss"] ?? false),
          iss: Number(t["iss"] ?? 0),
          cofins: Number(t["cofins"] ?? 0),
          csll: Number(t["csll"] ?? 0),
          inss: Number(t["inss"] ?? 0),
          ir: Number(t["ir"] ?? 0),
          pis: Number(t["pis"] ?? 0),
        },
      };
    } catch {
      // 404 = assinatura sem configuração. Não é erro, é o estado inicial.
      return null;
    }
  }

  /** Liga a emissão automática de NFS-e numa assinatura. */
  async configurarNotaFiscal(subscriptionId: string, cfg: ConfigNotaFiscal): Promise<void> {
    const corpo: Record<string, unknown> = {
      // Emitir na confirmação do pagamento, não na cobrança: nota de fatura
      // que não foi paga vira trabalho de cancelamento e imposto recolhido à
      // toa. `receivedOnly: false` porque no cartão a confirmação vem na hora
      // e o "recebimento" só uns 30 dias depois — o cliente não pode esperar
      // um mês pela nota de algo que já pagou.
      effectiveDatePeriod: cfg.effectiveDatePeriod ?? "ON_PAYMENT_CONFIRMATION",
      receivedOnly: cfg.receivedOnly ?? false,
      deductions: cfg.deductions ?? 0,
      observations: cfg.observations ?? undefined,
      taxes: cfg.taxes ?? { retainIss: false, iss: 0, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 },
    };
    if (cfg.municipalServiceId) corpo.municipalServiceId = cfg.municipalServiceId;
    if (cfg.municipalServiceCode) corpo.municipalServiceCode = cfg.municipalServiceCode;
    if (cfg.municipalServiceName) corpo.municipalServiceName = cfg.municipalServiceName;
    if (cfg.daysBeforeDueDate) corpo.daysBeforeDueDate = cfg.daysBeforeDueDate;

    await this.req(`/subscriptions/${subscriptionId}/invoiceSettings`, {
      method: "POST",
      body: JSON.stringify(corpo),
    });
  }

  /**
   * A última NFS-e AUTORIZADA pela prefeitura.
   *
   * É o molde mais seguro que existe: serviço municipal, alíquota e retenções
   * que já passaram pelo crivo de quem recebe o imposto. As notas 3 e 4 do
   * primeiro cliente saíram pelo painel, configuradas por quem conhece a
   * situação fiscal da empresa — e é exatamente isso que se copia. Uma
   * tentativa por API em julho, com código "1.05" e ISS 5%, nunca foi
   * autorizada; por isso o molde é a nota que a prefeitura aceitou, não o
   * que alguém achou que devia ser.
   */
  async ultimaNotaAutorizada(): Promise<(ConfigNotaFiscal & { invoiceId: string; numero: string | null }) | null> {
    type Inv = Record<string, unknown> & { taxes?: Record<string, unknown> };
    const r = await this.req<{ data?: Inv[] }>(`/invoices?status=AUTHORIZED&limit=50`);
    const lista = (r.data ?? []).filter((i) => i["municipalServiceId"] || i["municipalServiceCode"]);
    if (!lista.length) return null;
    lista.sort((a, b) => Number(b["number"] ?? 0) - Number(a["number"] ?? 0));
    const i = lista[0];
    const t = i.taxes ?? {};
    const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
    const s = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
    return {
      invoiceId: String(i["id"]),
      numero: s(i["number"]),
      municipalServiceId: s(i["municipalServiceId"]),
      municipalServiceCode: s(i["municipalServiceCode"]),
      municipalServiceName: s(i["municipalServiceName"]),
      serviceDescription: s(i["serviceDescription"]),
      deductions: n(i["deductions"]),
      observations: s(i["observations"]),
      effectiveDatePeriod: "ON_PAYMENT_CONFIRMATION",
      receivedOnly: false,
      daysBeforeDueDate: null,
      taxes: {
        retainIss: Boolean(t["retainIss"] ?? false),
        iss: n(t["iss"]),
        cofins: n(t["cofins"]),
        csll: n(t["csll"]),
        inss: n(t["inss"]),
        ir: n(t["ir"]),
        pis: n(t["pis"]),
      },
    };
  }

  /** As notas (em qualquer situação) já ligadas a uma cobrança. */
  async notasDoPagamento(paymentId: string): Promise<Array<{ id: string; status: string; numero: string | null }>> {
    const r = await this.req<{ data?: Array<Record<string, unknown>> }>(
      `/invoices?payment=${encodeURIComponent(paymentId)}&limit=100`,
    );
    return (r.data ?? []).map((i) => ({
      id: String(i["id"]),
      status: String(i["status"] ?? ""),
      numero: typeof i["number"] === "string" ? (i["number"] as string) : null,
    }));
  }

  /** Emite uma NFS-e para uma cobrança já paga, com os dados fiscais do molde. */
  async emitirNota(input: {
    paymentId: string;
    valor: number;
    descricao: string;
    molde: ConfigNotaFiscal;
    dataEmissao?: string;
  }): Promise<{ invoiceId: string; status: string }> {
    const m = input.molde;
    const corpo: Record<string, unknown> = {
      payment: input.paymentId,
      serviceDescription: input.descricao,
      observations: m.observations ?? "",
      value: input.valor,
      deductions: m.deductions ?? 0,
      // Data em Brasília, não em UTC: às 22h daqui o UTC já virou o dia.
      effectiveDate: input.dataEmissao ?? new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10),
      taxes: m.taxes ?? { retainIss: false, iss: 0, cofins: 0, csll: 0, inss: 0, ir: 0, pis: 0 },
    };
    if (m.municipalServiceId) corpo.municipalServiceId = m.municipalServiceId;
    if (m.municipalServiceCode) corpo.municipalServiceCode = m.municipalServiceCode;
    if (m.municipalServiceName) corpo.municipalServiceName = m.municipalServiceName;
    const r = await this.req<{ id: string; status: string }>(`/invoices`, {
      method: "POST",
      body: JSON.stringify(corpo),
    });
    return { invoiceId: r.id, status: r.status };
  }

  async consultarNota(invoiceId: string) {
    try {
      const i = await this.req<Record<string, unknown>>(`/invoices/${encodeURIComponent(invoiceId)}`);
      if (!i || typeof i !== "object" || !i["id"]) return null;
      const s = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
      return {
        id: String(i["id"]),
        status: String(i["status"] ?? ""),
        numero: s(i["number"]),
        pdfUrl: s(i["pdfUrl"]),
        xmlUrl: s(i["xmlUrl"]),
        emitidaEm: s(i["effectiveDate"]) ? new Date(String(i["effectiveDate"])) : null,
        paymentId: s(i["payment"]),
      };
    } catch {
      return null;
    }
  }

  async consultarAssinatura(subscriptionId: string) {
    try {
      const sub = await this.req<Record<string, unknown>>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
      if (!sub || typeof sub !== "object" || !sub["id"]) return null;
      const cartao = sub["creditCard"] as { creditCardNumber?: string | null } | null | undefined;
      const final = cartao?.creditCardNumber ? String(cartao.creditCardNumber) : null;
      return {
        status: String(sub["status"] ?? ""),
        billingType: String(sub["billingType"] ?? ""),
        temCartao: !!final,
        cartaoFinal: final,
        proximoVencimento: sub["nextDueDate"] ? new Date(String(sub["nextDueDate"])) : null,
      };
    } catch {
      return null;
    }
  }

  async listarCobrancasDaAssinatura(subscriptionId: string) {
    type Resp = {
      data: Array<{
        id: string;
        value: number;
        dueDate: string;
        status: string;
        paymentDate?: string | null;
        billingType?: string;
        invoiceUrl?: string;
      }>;
    };
    const r = await this.req<Resp>(`/subscriptions/${subscriptionId}/payments`);
    return (r.data ?? []).map((p) => ({
      chargeId: p.id,
      valor: p.value,
      vencimento: new Date(p.dueDate),
      status: mapearStatusAsaas(p.status),
      pagaEm: p.paymentDate ? new Date(p.paymentDate) : null,
      forma: (p.billingType === "PIX"
        ? "PIX"
        : p.billingType === "BOLETO"
          ? "BOLETO"
          : "CARTAO_CREDITO") as FormaPagamento,
      invoiceUrl: p.invoiceUrl,
    }));
  }

  async atualizarAssinatura(input: AtualizarAssinaturaInput): Promise<void> {
    await this.req(`/subscriptions/${input.subscriptionId}`, {
      method: "POST", // Asaas usa POST pra update tb
      body: JSON.stringify({ value: input.novoValor }),
    });
  }

  /**
   * Muda a data da próxima cobrança da assinatura. O Asaas gera a cobrança
   * dessa data na hora e segue o ciclo mensal a partir dela.
   */
  async atualizarProximoVencimento(subscriptionId: string, data: Date): Promise<{ proximoVencimento: string }> {
    const r = await this.req<{ nextDueDate: string }>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "PUT",
      body: JSON.stringify({ nextDueDate: data.toISOString().slice(0, 10), updatePendingPayments: false }),
    });
    return { proximoVencimento: r.nextDueDate };
  }

  /**
   * Paga uma cobrança já existente com um cartão informado agora.
   *
   * É o que evita a dívida sumir na troca de cartão (21/10/2026): com fatura
   * vencida, trocar o cartão criava assinatura nova e cancelava a antiga — e
   * o Asaas apagava a fatura junto. Aqui a fatura em aberto é cobrada neste
   * cartão antes de qualquer troca; se a operadora recusar, a troca não
   * acontece e o cliente fica sabendo na hora.
   */
  async pagarCobrancaComCartao(input: {
    chargeId: string;
    cartao: { numero: string; nome: string; validadeMes: number; validadeAno: number; cvv: string };
    titular: { nome: string; email: string; cpfCnpj: string; telefone?: string; cep?: string; numeroEndereco?: string };
  }): Promise<{ status: CriarCobrancaResultado["status"]; pagaEm: Date | null }> {
    const r = await this.req<{ status: string; confirmedDate?: string; paymentDate?: string }>(
      `/payments/${encodeURIComponent(input.chargeId)}/payWithCreditCard`,
      {
        method: "POST",
        body: JSON.stringify({
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
        }),
      },
    );
    const quando = r.confirmedDate ?? r.paymentDate ?? null;
    return { status: mapearStatusAsaas(r.status), pagaEm: quando ? new Date(quando) : null };
  }

  async cancelarAssinatura(subscriptionId: string): Promise<void> {
    await this.req(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
  }

  // Regina 13/07: PIX out pra pagar analista automaticamente.
  // Docs: https://docs.asaas.com/reference/transferencias-pix
  // POST /transfers com operationType=PIX + pixAddressKey.
  async transferirPix(input: {
    valor: number;
    chavePix: string;
    tipoChave: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
    descricao?: string;
    referenciaExterna?: string; // externalReference — link com Comissao.id
  }): Promise<{ transferId: string; status: string }> {
    type Resp = { id: string; status: string };
    const data = await this.req<Resp>("/transfers", {
      method: "POST",
      body: JSON.stringify({
        operationType: "PIX",
        value: input.valor,
        pixAddressKey: input.chavePix,
        pixAddressKeyType: input.tipoChave,
        description: input.descricao,
        externalReference: input.referenciaExterna,
      }),
    });
    return { transferId: data.id, status: data.status };
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
        payment?: {
          id?: string;
          status?: string;
          value?: number;
          paymentDate?: string;
          customer?: string;
          subscription?: string;
          dueDate?: string;
          billingType?: string;
          invoiceUrl?: string;
          deleted?: boolean;
        };
        invoice?: {
          id?: string;
          number?: string;
          status?: string;
          pdfUrl?: string;
          xmlUrl?: string;
          effectiveDate?: string;
          payment?: string;
        };
      };
      if (!data.event) return null;

      // Eventos de INVOICE (NFSe). Regina 03/07 — Asaas emite NF
      // automaticamente e nos avisa via webhook INVOICE_CREATED/SYNCHRONIZED.
      if (data.event.startsWith("INVOICE_") && data.invoice?.id) {
        return {
          evento: data.event,
          chargeId: data.invoice.payment, // paymentId pra achar a cobranca
          nfse: {
            nfseId: data.invoice.id,
            numero: data.invoice.number,
            status: data.invoice.status,
            pdfUrl: data.invoice.pdfUrl,
            xmlUrl: data.invoice.xmlUrl,
            emitidaEm: data.invoice.effectiveDate
              ? new Date(data.invoice.effectiveDate)
              : undefined,
            paymentIdRelacionado: data.invoice.payment,
          },
        };
      }

      // Eventos de PAYMENT (cobranca)
      if (!data.payment?.id) return null;
      // Cobrança apagada no Asaas (acontece quando a assinatura é cancelada:
      // as pendentes vão junto). O `status` interno dela continua PENDING ou
      // OVERDUE, e foi assim que uma cobrança já apagada virou linha PENDENTE
      // aqui em 21/10. Apagada é CANCELADA, não importa o que o status diga.
      const apagada = data.event === "PAYMENT_DELETED" || data.payment.deleted === true;
      const status = apagada
        ? "CANCELADA"
        : data.payment.status === "CONFIRMED" || data.payment.status === "RECEIVED"
          ? "PAGA"
          : data.payment.status === "OVERDUE"
            ? "ATRASADA"
            : data.payment.status === "REFUNDED"
              ? "ESTORNADA"
              : data.payment.status === "DELETED"
                ? "CANCELADA"
                : data.payment.status === "PENDING"
                  ? "PENDENTE"
                  : undefined;
      const forma: FormaPagamento | undefined =
        data.payment.billingType === "PIX"
          ? "PIX"
          : data.payment.billingType === "BOLETO"
            ? "BOLETO"
            : data.payment.billingType === "CREDIT_CARD"
              ? "CARTAO_CREDITO"
              : undefined;
      return {
        evento: data.event,
        chargeId: data.payment.id,
        status,
        valorPago: data.payment.value,
        pagaEm: data.payment.paymentDate ? new Date(data.payment.paymentDate) : undefined,
        cobranca: {
          customerId: data.payment.customer,
          subscriptionId: data.payment.subscription,
          valor: data.payment.value,
          vencimento: data.payment.dueDate ? new Date(data.payment.dueDate) : undefined,
          forma,
          invoiceUrl: data.payment.invoiceUrl,
        },
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
