// Tipos compartilhados entre os providers de pagamento.
// Mantém o resto do app desacoplado do ASAAS/Stripe específicos.

export type Plano = "BASICO" | "PREMIUM";
export type FormaPagamento = "CARTAO_CREDITO" | "PIX" | "BOLETO";

export const PRECO_PLANO: Record<Plano, number> = {
  BASICO: 397,
  PREMIUM: 997,
};

export type ClienteInput = {
  contaId: string;
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone?: string;
  endereco?: string;
};

export type CriarClienteResultado = { customerId: string };

export type CriarCobrancaInput = {
  customerId: string;
  cobrancaIdInterno: string;
  valor: number;
  vencimento: Date;
  forma: FormaPagamento;
  descricao: string;
  // Cartão (somente quando forma === CARTAO_CREDITO):
  cartao?: {
    numero: string;
    nome: string;
    validadeMes: number;
    validadeAno: number;
    cvv: string;
  };
};

export type CriarCobrancaResultado = {
  chargeId: string;
  invoiceUrl?: string;
  pixQrCode?: string;
  pixCopiaCola?: string;
  boletoUrl?: string;
  status: "PENDENTE" | "PROCESSANDO" | "PAGA" | "ATRASADA" | "CANCELADA";
};

export type EventoWebhook = {
  evento: string;
  chargeId?: string;
  status?: "PAGA" | "ATRASADA" | "CANCELADA" | "ESTORNADA";
  // valor pago (pode diferir do esperado)
  valorPago?: number;
  pagaEm?: Date;
};

// === Subscription Asaas (cartão recorrente automático — Regina 23/06) ===

export type CriarAssinaturaInput = {
  customerId: string;
  cobrancaIdInterno: string; // primeira cobranca interna que vamos vincular
  valor: number;
  proximoVencimento: Date;
  descricao: string;
  // Cartão de crédito tokenizado pelo Asaas (PCI-DSS):
  cartao: {
    numero: string;
    nome: string;
    validadeMes: number;
    validadeAno: number;
    cvv: string;
  };
  // Dados do titular (Asaas exige pra cartão)
  titular: {
    nome: string;
    email: string;
    cpfCnpj: string;
    telefone?: string;
    cep?: string;
    numeroEndereco?: string;
  };
};

export type CriarAssinaturaResultado = {
  subscriptionId: string;
  // primeira cobrança já gerada pela subscription
  primeiraCobranca: CriarCobrancaResultado;
};

export type AtualizarAssinaturaInput = {
  subscriptionId: string;
  novoValor: number;
};

export interface GatewayPagamento {
  readonly nome: "ASAAS" | "STRIPE" | "DEMO";
  criarCliente(input: ClienteInput): Promise<CriarClienteResultado>;
  criarCobranca(input: CriarCobrancaInput): Promise<CriarCobrancaResultado>;
  cancelarCobranca(chargeId: string): Promise<void>;
  validarWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parsearWebhook(rawBody: string): Promise<EventoWebhook | null>;
  // Subscriptions (opcional — só Asaas implementa por enquanto)
  criarAssinatura?(input: CriarAssinaturaInput): Promise<CriarAssinaturaResultado>;
  atualizarAssinatura?(input: AtualizarAssinaturaInput): Promise<void>;
  cancelarAssinatura?(subscriptionId: string): Promise<void>;
}
