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
  vencimento: string; // AAAA-MM-DD (atual no Asaas)
  /** Mês a que a cobrança se refere: o do nosso registro (Cobranca.competencia), senão o vencimento ORIGINAL no Asaas. */
  competencia: string;
  pagamento: string | null; // data em que foi pago
  credito: string | null; // data em que caiu (ou previsão)
  forma: string | null;
  descricao: string | null;
  contaId: string | null;
  contaNome: string | null;
  contaInterna: boolean;
  /** Nome do pagador no Asaas, preenchido só quando não há conta no CP System. */
  pagadorNome: string | null;
  /** PIX que caiu direto na chave, sem cobrança emitida e sem cliente do sistema: aporte de sócio. */
  aporte: boolean;
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
export async function pagamentosAsaas(desde = "2025-01-01", forcar = false): Promise<{ ok: true; dados: PagamentoAsaas[]; lidoEm: Date } | { ok: false; erro: string }> {
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
    // Competência pelo nosso registro: ajustes no Asaas (troca de cartão, data
    // remarcada) mudam o dueDate e jogavam a mensalidade para o mês errado.
    const locais = await prisma.cobranca.findMany({ where: { gatewayChargeId: { in: brutos.map((p) => p.id) } }, select: { gatewayChargeId: true, competencia: true } });
    const compLocal = new Map(locais.map((l) => [l.gatewayChargeId as string, l.competencia]));
    // Pagadores sem conta no CP System (Regina 09/11/2026: são os aportes dela e do Igor).
    const semConta = Array.from(new Set(brutos.filter((p) => !porCustomer.has(p.customer)).map((p) => p.customer)));
    const nomes = new Map(await Promise.all(semConta.map(async (c) => [c, (await g.nomeDoCliente(c))?.nome || null] as const)));
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
        competencia: compLocal.get(p.id) ?? (p.originalDueDate ?? p.dueDate).slice(0, 7),
        pagamento: p.paymentDate ?? p.clientPaymentDate ?? p.confirmedDate ?? null,
        credito: p.creditDate ?? p.estimatedCreditDate ?? null,
        forma: p.billingType ?? null,
        descricao: p.description ?? null,
        contaId: c?.id ?? null,
        contaNome: c ? c.empresas[0]?.nomeFantasia || c.empresas[0]?.razaoSocial || null : null,
        contaInterna: !!c && (c.contaTeste || c.usuarios.some((u) => u.superAdmin)),
        pagadorNome: c ? null : (nomes.get(p.customer) ?? null),
        aporte: !c && !p.subscription && STATUS_RECEBIDO.includes(p.status),
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
    if (!p.contaId || p.aporte) continue;
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

export type AporteSocio = { pagador: string; total: number; quantidade: number; lancamentos: { data: string; valor: number }[] };

/** Aportes por pessoa, desde o primeiro registro no Asaas. */
export function aportesPorPagador(dados: PagamentoAsaas[]): AporteSocio[] {
  const m = new Map<string, AporteSocio>();
  for (const p of dados) {
    if (!p.aporte) continue;
    const nome = p.pagadorNome || `Cliente Asaas ${p.customer}`;
    const a = m.get(nome) ?? { pagador: nome, total: 0, quantidade: 0, lancamentos: [] };
    a.total += p.valor;
    a.quantidade += 1;
    a.lancamentos.push({ data: p.pagamento ?? p.vencimento, valor: p.valor });
    m.set(nome, a);
  }
  for (const a of m.values()) a.lancamentos.sort((x, y) => x.data.localeCompare(y.data));
  return Array.from(m.values()).sort((x, y) => y.total - x.total);
}

// ─────────────────────────────────────────────
// Saídas da conta Asaas → despesas do DRE (Regina 10/11/2026: "o DRE não está
// incluindo os pagamentos feitos para o Tales, para a Jéssica, para outros
// serviços"). Classificação automática pelo destinatário; a Regina pode
// trocar na tela (ParametroPlataforma `dre.classificacaoSaidas`).
// ─────────────────────────────────────────────

export const CHAVE_CLASSIFICACAO_SAIDAS = "dre.classificacaoSaidas";
/** Categorias de despesa + duas especiais que NÃO entram no resultado. */
export type ClasseSaida = "INFRAESTRUTURA" | "IA" | "FERRAMENTAS" | "MARKETING" | "CONTABILIDADE" | "IMPOSTOS" | "PESSOAL" | "OUTROS" | "RETIRADA_SOCIO" | "IGNORAR";

export type SaidaAsaas = {
  id: string;
  data: string; // AAAA-MM-DD
  valor: number; // positivo
  tipo: string; // TRANSFER | BILL_PAYMENT | ...
  destinatario: string;
  descricao: string;
  classe: ClasseSaida;
  automatica: boolean; // true = regra; false = escolhida pela Regina
  revisar: boolean; // regra incerta
};

const TIPOS_TAXA = ["PAYMENT_FEE", "PAYMENT_MESSAGING_NOTIFICATION_FEE", "INVOICE_FEE", "RECEIVABLE_ANTICIPATION_FEE", "TRANSFER_FEE", "PIX_TRANSACTION_FEE", "NOTIFICATION_FEE", "BILL_PAYMENT_FEE"];

function classificar(destinatario: string, descricao: string, socios: string[]): { classe: ClasseSaida; revisar: boolean } {
  const t = `${destinatario} ${descricao}`.toUpperCase();
  if (/GOOGLE CLOUD|VERCEL|NEON|AMAZON WEB|REGISTRO\.BR|HOSTINGER/.test(t)) return { classe: "INFRAESTRUTURA", revisar: false };
  if (/ANTHROPIC|OPENAI/.test(t)) return { classe: "IA", revisar: false };
  if (/FACEBOOK|META PLATFORMS|GOOGLE BRASIL INTERNET|TR[AÁ]FEGO|AN[UÚ]NCIO/.test(t)) return { classe: "MARKETING", revisar: false };
  if (/TELEFONICA|CLARO|TIM S|OI S\.A|Z-API|ASAAS|NOTION|CANVA/.test(t)) return { classe: "FERRAMENTAS", revisar: false };
  if (/CONTAB|ESCRITEC|LEONARDO OLIVEIRA/.test(t)) return { classe: "CONTABILIDADE", revisar: false };
  if (/MINISTERIO DA FAZENDA|RECEITA FEDERAL|DARF|DAS |SIMPLES|PROPRIEDADE INDUSTRIAL|INPI|PREFEITURA|SEFAZ/.test(t)) return { classe: "IMPOSTOS", revisar: false };
  if (socios.some((s) => s && t.includes(s))) return { classe: "RETIRADA_SOCIO", revisar: true };
  if (/IGREJA|DOA[CÇ][AÃ]O/.test(t)) return { classe: "OUTROS", revisar: true };
  if (/PAGAMENTO DE CONTA/.test(t)) return { classe: "OUTROS", revisar: true };
  // PIX para pessoa física/jurídica sem regra: serviço contratado (Tales, Jéssica…)
  return { classe: "PESSOAL", revisar: true };
}

export async function saidasAsaas(desde = "2025-01-01"): Promise<{ ok: true; saidas: SaidaAsaas[]; taxasPorMes: Map<string, number> } | { ok: false; erro: string }> {
  const g = await asaasDisponivel();
  if (!g) return { ok: false, erro: "Gateway Asaas não configurado neste ambiente." };
  try {
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const [extrato, transferencias, param] = await Promise.all([
      g.listarExtrato(desde, hoje),
      g.listarTransferencias(desde),
      prisma.parametroPlataforma.findUnique({ where: { chave: CHAVE_CLASSIFICACAO_SAIDAS } }),
    ]);
    const escolhas = (param?.valor && typeof param.valor === "object" ? param.valor : {}) as Record<string, ClasseSaida>;
    const porTransfer = new Map(transferencias.map((t) => [t.id, t]));
    // Sócios = quem fez aporte (pagadores sem conta) — mesmos nomes do Asaas.
    const socios = ["REGINA LUIZA DA SILVA FERNANDES", "IGOR DA SILVA FERNANDES"];
    const taxasPorMes = new Map<string, number>();
    const saidas: SaidaAsaas[] = [];
    for (const e of extrato) {
      if (e.value >= 0) continue;
      const valor = Math.round(-e.value * 100) / 100;
      if (TIPOS_TAXA.includes(e.type)) {
        taxasPorMes.set(e.date.slice(0, 7), (taxasPorMes.get(e.date.slice(0, 7)) ?? 0) + valor);
        continue;
      }
      const tr = e.transferId ? porTransfer.get(e.transferId) : undefined;
      if (tr?.externalReference?.startsWith("comissao-")) continue; // já está na linha de comissões
      const destinatario = tr?.bankAccount?.ownerName || (e.description ?? "").replace(/^Transação via Pix com (QR Code|chave) para /i, "") || e.type;
      const descricao = tr?.description || (e.type === "BILL_PAYMENT" ? "Pagamento de conta (boleto)" : "");
      const auto = classificar(destinatario, descricao, socios);
      const escolhida = escolhas[e.id];
      saidas.push({ id: e.id, data: e.date, valor, tipo: e.type, destinatario, descricao, classe: escolhida ?? auto.classe, automatica: !escolhida, revisar: !escolhida && auto.revisar });
    }
    saidas.sort((a, b) => b.data.localeCompare(a.data));
    return { ok: true, saidas, taxasPorMes };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
