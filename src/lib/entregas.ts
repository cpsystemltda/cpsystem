import "server-only";

/**
 * Entrega em parcelas e inexecução — o que a esteira precisa saber.
 *
 * Demanda de cliente, 23/09/2026. A esteira tratava entrega como um carimbo
 * único: uma data, e pronto. Na vida real a entrega sai em parcelas, e às
 * vezes não sai. O sistema não tinha onde registrar *o que* foi entregue, nem
 * o que deixou de ser — e nota fiscal acabava liberada em cima de entrega que
 * não aconteceu inteira.
 *
 * As regras que este módulo carrega, e o porquê de cada uma:
 *
 * - **Inexecução total tranca a esteira.** Não existe nota fiscal, nem
 *   encaminhamento, nem pagamento de coisa que não foi entregue. Emitir nota
 *   nessa situação não é erro de sistema, é problema fiscal da empresa.
 * - **Inexecução parcial deixa seguir, mas marca.** Parte foi entregue e
 *   precisa ser faturada; o que faltou vira etiqueta no documento, porque
 *   reaparece em fiscalização e na habilitação da próxima licitação.
 * - **Entrega parcial não fecha a etapa.** Enquanto faltar quantidade, o
 *   próximo passo é "Entrega 2", não "Nota fiscal emitida".
 * - **A conta é por item**, não pelo valor: o órgão cobra quantidade entregue,
 *   e é isso que a empresa tem que provar.
 */

export type TipoEntrega = "TOTAL" | "PARCIAL" | "INEXECUCAO_TOTAL" | "INEXECUCAO_PARCIAL";

export type ItemDoEmpenho = { id: string; descricao: string; unidade: string; quantidade: number };

export type EntregaRegistrada = {
  id: string;
  ordem: number;
  tipo: TipoEntrega;
  data: Date;
  observacao: string | null;
  arquivoUrl: string | null;
  itens: { itemId: string; quantidade: number }[];
};

export type SituacaoEntrega = {
  /** Quanto já foi entregue de cada item, somando todas as entregas. */
  entreguePorItem: Map<string, number>;
  /** Não falta quantidade em nenhum item. */
  completa: boolean;
  /** Há inexecução total declarada — esteira travada. */
  inexecucaoTotal: boolean;
  /** Há inexecução parcial declarada — só etiqueta. */
  inexecucaoParcial: boolean;
  /** Número da próxima entrega na linha do tempo (1 se nenhuma ainda). */
  proximaOrdem: number;
  /** Percentual entregue, ponderado pela quantidade total. 0 a 100. */
  percentual: number;
};

/**
 * Lê o estado da entrega a partir dos eventos registrados.
 *
 * Deriva tudo dos eventos em vez de guardar um campo "situação" no empenho:
 * campo duplicado sai do ar assim que alguém desfaz uma entrega, e aí a
 * etiqueta mente. Aqui a única fonte é o que foi registrado.
 */
export function situacaoEntrega(
  itens: ItemDoEmpenho[],
  entregas: EntregaRegistrada[],
): SituacaoEntrega {
  const entreguePorItem = new Map<string, number>();
  let inexecucaoTotal = false;
  let inexecucaoParcial = false;
  let houveTotal = false;

  for (const e of entregas) {
    if (e.tipo === "INEXECUCAO_TOTAL") inexecucaoTotal = true;
    if (e.tipo === "INEXECUCAO_PARCIAL") inexecucaoParcial = true;
    if (e.tipo === "TOTAL") houveTotal = true;
    for (const i of e.itens) {
      entreguePorItem.set(i.itemId, (entreguePorItem.get(i.itemId) ?? 0) + i.quantidade);
    }
  }

  // Entrega TOTAL não lista item: ela declara que saiu tudo. Preenche o mapa
  // para as telas mostrarem 100% sem precisar de caso especial.
  if (houveTotal) {
    for (const item of itens) entreguePorItem.set(item.id, item.quantidade);
  }

  const totalPrevisto = itens.reduce((s, i) => s + i.quantidade, 0);
  const totalEntregue = itens.reduce(
    (s, i) => s + Math.min(entreguePorItem.get(i.id) ?? 0, i.quantidade),
    0,
  );

  // Inexecução parcial encerra a etapa de entrega: o que faltou não vai vir, e
  // manter "Entrega 3" pendente para sempre seria pedir uma entrega que a
  // empresa já declarou que não acontece.
  const completa =
    houveTotal ||
    inexecucaoParcial ||
    (itens.length > 0 && itens.every((i) => (entreguePorItem.get(i.id) ?? 0) >= i.quantidade));

  return {
    entreguePorItem,
    completa,
    inexecucaoTotal,
    inexecucaoParcial,
    proximaOrdem: entregas.reduce((max, e) => Math.max(max, e.ordem), 0) + 1,
    percentual: totalPrevisto > 0 ? Math.round((totalEntregue / totalPrevisto) * 100) : 0,
  };
}

/** O que ainda falta entregar de cada item. Nunca negativo. */
export function faltaPorItem(
  itens: ItemDoEmpenho[],
  situacao: SituacaoEntrega,
): { item: ItemDoEmpenho; entregue: number; falta: number }[] {
  return itens.map((item) => {
    const entregue = situacao.entreguePorItem.get(item.id) ?? 0;
    return { item, entregue, falta: Math.max(0, item.quantidade - entregue) };
  });
}

/** Rótulo curto de cada tipo, o mesmo em toda tela. */
export const LABEL_TIPO_ENTREGA: Record<TipoEntrega, string> = {
  TOTAL: "Entrega total",
  PARCIAL: "Entrega parcial",
  INEXECUCAO_TOTAL: "Inexecução total",
  INEXECUCAO_PARCIAL: "Inexecução parcial",
};
