import "server-only";
import { prisma } from "@/lib/prisma";
import { getGateway } from "@/lib/gateway";
import { GatewayAsaas } from "@/lib/gateway/asaas";

/**
 * Leitura financeira direto do Asaas (Regina, 09/11/2026: "no DRE você não
 * puxou nada real do Asaas, está tudo desatualizado"). O DRE e a lista de
 * Clientes do admin passam a mostrar o que o gateway registra — valor pago,
 * data em que o dinheiro entrou, taxa cobrada, o que está em aberto — em vez
 * do espelho local, que só sabia o que o webhook tinha avisado.
 *
 * Cache de 5 minutos por instância: a página do admin abre várias vezes
 * seguidas e o Asaas tem limite de requisições.
 */

export type PagamentoAsaas = {
  id: string;
  customer: string;
  subscription: string | null;
  valor: number;
  liquido: number | null;
  status: string; // PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED | RECEIVED_IN_CASH | ...
  vencimento: string; // AAAA-MM-DD
  pagamento: string | null; // data em que foi pago
  credito: string | null; // data em que caiu (ou previsão)
  forma: string | null;
  descricao: string | null;
  contaId: string | null;
  contaNome: string | null;
  contaInterna: boolean;
};

export const STATUS_RECEBIDO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
export const STATUS_EM_ABERTO = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"];
export const STATUS_ESTORNO = ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"];

let cache: { em: number; dados: PagamentoAsaas[] } | null = null;

export async function asaasDisponivel(): Promise<GatewayAsaas | null> {
  const g = await getGateway();
  return g instanceof GatewayAsaas ? g : null;
}

/** Todas as cobranças desde `desde` (vencimento), com o cliente do CP System ao lado. */
export async function pagamentosAsaas(desde = "2026-01-01", forcar = false): Promise<{ ok: true; dados: PagamentoAsaas[]; lidoEm: Date } | { ok: false; erro: string }> {
  if (!forcar && cache && Date.now() - cache.em < 5 * 60_000) return { ok: true, dados: cache.dados, lidoEm: new Date(cache.em) };
  const g = await asaasDisponivel();
  if (!g) return { ok: false, erro: "Gateway Asaas não configurado neste ambiente." };
  try {
    const brutos = await g.listarPagamentos({ dueDateDe: desde });
    const contas = await prisma.conta.findMany({
      where: { gatewayCustomerId: { not: null } },
      select: { id: true, gatewayCustomerId: true, contaTeste: true, usuarios: { select: { superAdmin: true } }, empresas: { select: { razaoSocial: true, nomeFantasia: true }, take: 1, orderBy: { criadoEm: "asc" } } },
    });
    const porCustomer = new Map(contas.map((c) => [c.gatewayCustomerId as string, c]));
    const dados: PagamentoAsaas[] = brutos.map((p) => {
      const c = porCustomer.get(p.customer);
      return {
        id: p.id,
        customer: p.customer,
        subscription: p.subscription ?? null,
        valor: p.value,
        liquido: p.netValue ?? null,
        status: p.status,
        vencimento: p.dueDate,
        pagamento: p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate ?? null,
        credito: p.creditDate ?? p.estimatedCreditDate ?? null,
        forma: p.billingType ?? null,
        descricao: p.description ?? null,
        contaId: c?.id ?? null,
        contaNome: c ? c.empresas[0]?.nomeFantasia || c.empresas[0]?.razaoSocial || null : null,
        contaInterna: !!c && (c.contaTeste || c.usuarios.some((u) => u.superAdmin)),
      };
    });
    cache = { em: Date.now(), dados };
    return { ok: true, dados, lidoEm: new Date() };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type ResumoCobrancaConta = {
  ultimaPaga: { data: string; valor: number; forma: string | null } | null;
  proxima: { vencimento: string; valor: number; status: string; forma: string | null } | null;
  emAtraso: { vencimento: string; valor: number }[];
};

/** Por conta: último pagamento recebido, próximo vencimento e o que está em atraso. */
export function resumoPorConta(dados: PagamentoAsaas[], hoje = new Date()): Map<string, ResumoCobrancaConta> {
  const hojeIso = hoje.toISOString().slice(0, 10);
  const out = new Map<string, ResumoCobrancaConta>();
  for (const p of dados) {
    if (!p.contaId) continue;
    const r = out.get(p.contaId) ?? { ultimaPaga: null, proxima: null, emAtraso: [] };
    if (STATUS_RECEBIDO.includes(p.status) && p.pagamento) {
      if (!r.ultimaPaga || p.pagamento > r.ultimaPaga.data) r.ultimaPaga = { data: p.pagamento, valor: p.valor, forma: p.forma };
    } else if (p.status === "OVERDUE" || (p.status === "PENDING" && p.vencimento < hojeIso)) {
      r.emAtraso.push({ vencimento: p.vencimento, valor: p.valor });
    }
    if (STATUS_EM_ABERTO.includes(p.status) && p.vencimento >= hojeIso) {
      if (!r.proxima || p.vencimento < r.proxima.vencimento) r.proxima = { vencimento: p.vencimento, valor: p.valor, status: p.status, forma: p.forma };
    }
    out.set(p.contaId, r);
  }
  return out;
}
