import "server-only";
import { prisma } from "@/lib/prisma";
import { GatewayDemo } from "./demo";
import { GatewayAsaas } from "./asaas";
import type { GatewayPagamento } from "./types";

export * from "./types";

let cache: { gateway: GatewayPagamento; carregadoEm: number } | null = null;
const TTL_MS = 30 * 1000;

// Carrega o gateway ativo baseado na configuração persistida ou .env.
// Cache curto pra evitar query a cada call.
export async function getGateway(): Promise<GatewayPagamento> {
  if (cache && Date.now() - cache.carregadoEm < TTL_MS) return cache.gateway;

  const cfg = await prisma.configuracaoGateway.findUnique({ where: { id: "singleton" } });
  const provider = cfg?.provider || (process.env.GATEWAY_PROVIDER as "ASAAS" | "STRIPE" | "DEMO") || "DEMO";
  const apiKey = cfg?.apiKey || process.env.ASAAS_API_KEY || "";
  const ambiente = (cfg?.ambiente as "sandbox" | "production") || (process.env.ASAAS_AMBIENTE as "sandbox" | "production") || "sandbox";
  const webhookToken = cfg?.webhookToken || process.env.ASAAS_WEBHOOK_TOKEN || "";

  let gateway: GatewayPagamento;
  if (provider === "ASAAS" && apiKey) {
    gateway = new GatewayAsaas({ apiKey, ambiente, webhookToken });
  } else {
    gateway = new GatewayDemo();
  }

  cache = { gateway, carregadoEm: Date.now() };
  return gateway;
}

export function invalidarCacheGateway() {
  cache = null;
}

// Status legível pra UI
export async function statusGateway(): Promise<{ provider: string; configurado: boolean; ambiente: string }> {
  // Regina 24/08: a tela de assinatura do cliente mostrava "Modo demo — nenhuma
  // cobranca real e feita" para o Leo, que paga de verdade. O motivo: esta
  // funcao so olhava a configuracao gravada no banco, que esta vazia — a chave
  // do Asaas vive nas variaveis de ambiente da Vercel (mais seguro que texto
  // puro no banco). Agora ela responde a mesma pergunta que `getGateway` faz na
  // hora de cobrar, senao a tela contradiz o que o sistema realmente executa.
  const cfg = await prisma.configuracaoGateway.findUnique({ where: { id: "singleton" } });
  const apiKey = cfg?.apiKey || process.env.ASAAS_API_KEY || "";
  const providerBruto =
    cfg?.provider || (process.env.GATEWAY_PROVIDER as "ASAAS" | "STRIPE" | "DEMO") || "DEMO";
  // Sem chave nao ha como cobrar de verdade, entao continua sendo demo.
  const provider = providerBruto === "ASAAS" && !apiKey ? "DEMO" : providerBruto;
  const ambiente = cfg?.ambiente || process.env.ASAAS_AMBIENTE || "sandbox";
  return { provider, configurado: !!apiKey, ambiente };
}
