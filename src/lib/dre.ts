import "server-only";
import { prisma } from "@/lib/prisma";
import { pagamentosAsaas, STATUS_EM_ABERTO, STATUS_ESTORNO, STATUS_RECEBIDO } from "@/lib/asaasFinanceiro";
import {
  CATEGORIAS_DESPESA,
  ROTULO_CATEGORIA,
  ehCategoria,
  competenciaAtualBrt,
  competenciasEntre,
  somarMeses,
  rotuloMes,
  type CategoriaDespesa,
} from "@/lib/dreConstantes";

export { CATEGORIAS_DESPESA, ROTULO_CATEGORIA, ehCategoria, competenciaAtualBrt, competenciasEntre, somarMeses, rotuloMes };
export type { CategoriaDespesa };

/**
 * DRE mensal da plataforma (Regina, 07/11/2026): *"para a gente ter a visão
 * financeira, inclusive dos meses anteriores"*.
 *
 * Regime de COMPETÊNCIA: cada linha pertence ao mês a que se refere, não ao
 * mês em que o dinheiro entrou ou saiu. A fatura de outubro paga em 3/11 é
 * receita de outubro; a comissão de outubro, paga quando o PIX do cliente
 * cai, é custo de outubro. É assim que a Regina lê o negócio — e é o que
 * permite comparar mês contra mês.
 *
 * Receita (Regina 09/11/2026): lida direto do ASAAS — cobranças recebidas,
 * taxas, estornos e o que está em aberto. O espelho local (`Cobranca`) só é
 * usado se o Asaas não responder, e a página avisa.
 *
 * O que vem sozinho do banco:
 * - Receita (reserva): faturas PAGAS de contas EMPRESA que não são internas
 *   (Regina/Igor têm conta para operar e nunca pagam; mesma regra de
 *   `metricasReceita`). Estornos entram como dedução.
 * - Comissões: R$ 29,90 por vínculo (`Comissao`), pagas ou a pagar — o custo
 *   nasce com a fatura do cliente, não com o PIX do repasse.
 *
 * O que NÃO entra: `PagamentoFixoMensal` e `ComissaoExecucao` são o que a
 * EMPRESA cliente paga ao analista dela, não custo do CP System.
 *
 * O que o sistema não sabe: Vercel, Neon, Anthropic, Z-API, Google Ads,
 * contador, impostos. Entra à mão em `DespesaPlataforma`, por competência.
 */

export type LinhaDre = {
  competencia: string; // YYYY-MM
  receitaBruta: number;
  faturasPagas: number;
  clientesPagantes: number;
  estornos: number;
  /** Taxas cobradas pelo Asaas (valor − líquido). */
  taxasGateway: number;
  receitaLiquida: number;
  /** Dinheiro que efetivamente entrou no mês (data do pagamento no Asaas). */
  recebidoNoMes: number;
  comissoes: number;
  comissoesPagas: number;
  margemContribuicao: number;
  despesas: Partial<Record<CategoriaDespesa, number>>;
  totalDespesas: number;
  resultado: number;
  /** Faturas da competência ainda em aberto (pendente, atrasada, em retentativa). */
  aReceber: number;
};

export type Despesa = {
  id: string;
  competencia: string;
  categoria: string;
  descricao: string;
  valor: number;
  criadoEm: Date;
};

export type Dre = {
  meses: LinhaDre[];
  totais: Omit<LinhaDre, "competencia">;
  despesas: Despesa[];
  competenciaAtual: string;
  /** De onde veio a receita: "ASAAS" (dado real) ou "LOCAL" (reserva, quando o Asaas não respondeu). */
  fonte: "ASAAS" | "LOCAL";
  fonteErro: string | null;
  lidoEm: Date | null;
  /** Pagamentos do Asaas sem cliente correspondente no CP System. */
  semCliente: { id: string; valor: number; vencimento: string; status: string }[];
};

/** "2026-07-BONUS-INICIO" → "2026-07". */
function mesDaCompetencia(c: string): string {
  return c.slice(0, 7);
}

function linhaVazia(competencia: string): LinhaDre {
  return {
    competencia,
    receitaBruta: 0,
    faturasPagas: 0,
    clientesPagantes: 0,
    estornos: 0,
    taxasGateway: 0,
    receitaLiquida: 0,
    recebidoNoMes: 0,
    comissoes: 0,
    comissoesPagas: 0,
    margemContribuicao: 0,
    despesas: {},
    totalDespesas: 0,
    resultado: 0,
    aReceber: 0,
  };
}

export async function montarDre(opts?: { ate?: string }): Promise<Dre> {
  const competenciaAtual = competenciaAtualBrt();
  const ate = opts?.ate && /^\d{4}-\d{2}$/.test(opts.ate) ? opts.ate : competenciaAtual;

  const [cobrancasLocais, comissoes, despesasRaw, asaas] = await Promise.all([
    prisma.cobranca.findMany({
      where: {
        status: { in: ["PAGA", "ESTORNADA", "PENDENTE", "ATRASADA", "PROCESSANDO"] },
        conta: { tipo: "EMPRESA", contaTeste: false, usuarios: { none: { superAdmin: true } } },
      },
      select: { contaId: true, competencia: true, status: true, valor: true },
    }),
    prisma.comissao.findMany({ select: { competencia: true, valor: true, paga: true } }),
    prisma.despesaPlataforma.findMany({
      orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
      select: { id: true, competencia: true, categoria: true, descricao: true, valor: true, criadoEm: true },
    }),
    pagamentosAsaas("2026-01-01"),
  ]);

  // Regina 09/11/2026: o DRE lê o Asaas. Competência = mês do vencimento da
  // cobrança; "recebido no mês" = mês da data de pagamento (caixa). Contas
  // internas e de teste ficam fora. Sem resposta do Asaas, usa o espelho
  // local e a página avisa.
  type Mov = { contaId: string; competencia: string; status: "PAGA" | "ESTORNADA" | "ABERTA"; valor: number; taxa: number; pagoEm: string | null };
  let movs: Mov[];
  const semCliente: Dre["semCliente"] = [];
  if (asaas.ok) {
    movs = [];
    for (const p of asaas.dados) {
      if (p.contaInterna) continue;
      const st = STATUS_RECEBIDO.includes(p.status) ? "PAGA" : STATUS_ESTORNO.includes(p.status) ? "ESTORNADA" : STATUS_EM_ABERTO.includes(p.status) ? "ABERTA" : null;
      if (!st) continue;
      if (!p.contaId) semCliente.push({ id: p.id, valor: p.valor, vencimento: p.vencimento, status: p.status });
      movs.push({ contaId: p.contaId ?? `asaas:${p.customer}`, competencia: p.vencimento.slice(0, 7), status: st, valor: p.valor, taxa: st === "PAGA" && p.liquido != null ? Math.max(0, p.valor - p.liquido) : 0, pagoEm: st === "PAGA" ? p.pagamento : null });
    }
  } else {
    movs = cobrancasLocais.map((c) => ({ contaId: c.contaId, competencia: c.competencia, status: c.status === "PAGA" ? "PAGA" : c.status === "ESTORNADA" ? "ESTORNADA" : "ABERTA", valor: c.valor, taxa: 0, pagoEm: null }));
  }

  // O DRE começa no primeiro mês em que existe qualquer movimento.
  const primeiras = [
    ...movs.filter((c) => c.status === "PAGA").map((c) => c.competencia),
    ...comissoes.map((c) => mesDaCompetencia(c.competencia)),
    ...despesasRaw.map((d) => d.competencia),
  ].filter((c) => /^\d{4}-\d{2}$/.test(c));
  const de = primeiras.length ? primeiras.sort()[0] : ate;

  const porMes = new Map<string, LinhaDre>();
  for (const c of competenciasEntre(de <= ate ? de : ate, ate)) porMes.set(c, linhaVazia(c));
  const linha = (c: string) => porMes.get(mesDaCompetencia(c));

  const pagantesPorMes = new Map<string, Set<string>>();
  for (const c of movs) {
    const l = linha(c.competencia);
    if (c.status === "PAGA" && c.pagoEm) {
      const lc = porMes.get(c.pagoEm.slice(0, 7));
      if (lc) lc.recebidoNoMes += c.valor - c.taxa;
    }
    if (!l) continue;
    if (c.status === "PAGA") {
      l.receitaBruta += c.valor;
      l.taxasGateway += c.taxa;
      l.faturasPagas += 1;
      if (!pagantesPorMes.has(l.competencia)) pagantesPorMes.set(l.competencia, new Set());
      pagantesPorMes.get(l.competencia)!.add(c.contaId);
    } else if (c.status === "ESTORNADA") {
      l.estornos += c.valor;
    } else {
      l.aReceber += c.valor;
    }
  }
  for (const [c, set] of pagantesPorMes) porMes.get(c)!.clientesPagantes = set.size;

  for (const c of comissoes) {
    const l = linha(c.competencia);
    if (!l) continue;
    l.comissoes += c.valor;
    if (c.paga) l.comissoesPagas += c.valor;
  }

  for (const d of despesasRaw) {
    const l = linha(d.competencia);
    if (!l) continue;
    const cat: CategoriaDespesa = ehCategoria(d.categoria) ? d.categoria : "OUTROS";
    l.despesas[cat] = (l.despesas[cat] ?? 0) + d.valor;
    l.totalDespesas += d.valor;
  }

  const meses = Array.from(porMes.values());
  for (const l of meses) {
    l.receitaLiquida = l.receitaBruta - l.estornos - l.taxasGateway;
    l.margemContribuicao = l.receitaLiquida - l.comissoes;
    l.resultado = l.margemContribuicao - l.totalDespesas;
  }

  const totais = linhaVazia("total");
  const pagantesTotal = new Set<string>();
  for (const c of movs) if (c.status === "PAGA" && porMes.has(mesDaCompetencia(c.competencia))) pagantesTotal.add(c.contaId);
  for (const l of meses) {
    totais.receitaBruta += l.receitaBruta;
    totais.faturasPagas += l.faturasPagas;
    totais.estornos += l.estornos;
    totais.taxasGateway += l.taxasGateway;
    totais.recebidoNoMes += l.recebidoNoMes;
    totais.receitaLiquida += l.receitaLiquida;
    totais.comissoes += l.comissoes;
    totais.comissoesPagas += l.comissoesPagas;
    totais.margemContribuicao += l.margemContribuicao;
    totais.totalDespesas += l.totalDespesas;
    totais.resultado += l.resultado;
    totais.aReceber += l.aReceber;
    for (const [k, v] of Object.entries(l.despesas)) {
      const cat = k as CategoriaDespesa;
      totais.despesas[cat] = (totais.despesas[cat] ?? 0) + (v ?? 0);
    }
  }
  totais.clientesPagantes = pagantesTotal.size;
  const { competencia: _c, ...totaisSemCompetencia } = totais;
  void _c;

  return {
    meses,
    totais: totaisSemCompetencia,
    despesas: despesasRaw,
    competenciaAtual,
    fonte: asaas.ok ? "ASAAS" : "LOCAL",
    fonteErro: asaas.ok ? null : asaas.erro,
    lidoEm: asaas.ok ? asaas.lidoEm : null,
    semCliente,
  };
}
