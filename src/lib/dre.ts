import "server-only";
import { prisma } from "@/lib/prisma";
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
 * O que vem sozinho do banco:
 * - Receita: faturas PAGAS de contas EMPRESA que não são internas
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
  receitaLiquida: number;
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
    receitaLiquida: 0,
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

  const [cobrancas, comissoes, despesasRaw] = await Promise.all([
    prisma.cobranca.findMany({
      where: {
        status: { in: ["PAGA", "ESTORNADA", "PENDENTE", "ATRASADA", "PROCESSANDO"] },
        conta: { tipo: "EMPRESA", usuarios: { none: { superAdmin: true } } },
      },
      select: { contaId: true, competencia: true, status: true, valor: true },
    }),
    prisma.comissao.findMany({ select: { competencia: true, valor: true, paga: true } }),
    prisma.despesaPlataforma.findMany({
      orderBy: [{ competencia: "desc" }, { criadoEm: "desc" }],
      select: { id: true, competencia: true, categoria: true, descricao: true, valor: true, criadoEm: true },
    }),
  ]);

  // O DRE começa no primeiro mês em que existe qualquer movimento.
  const primeiras = [
    ...cobrancas.filter((c) => c.status === "PAGA").map((c) => c.competencia),
    ...comissoes.map((c) => mesDaCompetencia(c.competencia)),
    ...despesasRaw.map((d) => d.competencia),
  ].filter((c) => /^\d{4}-\d{2}$/.test(c));
  const de = primeiras.length ? primeiras.sort()[0] : ate;

  const porMes = new Map<string, LinhaDre>();
  for (const c of competenciasEntre(de <= ate ? de : ate, ate)) porMes.set(c, linhaVazia(c));
  const linha = (c: string) => porMes.get(mesDaCompetencia(c));

  const pagantesPorMes = new Map<string, Set<string>>();
  for (const c of cobrancas) {
    const l = linha(c.competencia);
    if (!l) continue;
    if (c.status === "PAGA") {
      l.receitaBruta += c.valor;
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
    l.receitaLiquida = l.receitaBruta - l.estornos;
    l.margemContribuicao = l.receitaLiquida - l.comissoes;
    l.resultado = l.margemContribuicao - l.totalDespesas;
  }

  const totais = linhaVazia("total");
  const pagantesTotal = new Set<string>();
  for (const c of cobrancas) if (c.status === "PAGA" && porMes.has(mesDaCompetencia(c.competencia))) pagantesTotal.add(c.contaId);
  for (const l of meses) {
    totais.receitaBruta += l.receitaBruta;
    totais.faturasPagas += l.faturasPagas;
    totais.estornos += l.estornos;
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

  return { meses, totais: totaisSemCompetencia, despesas: despesasRaw, competenciaAtual };
}
