/**
 * Por que uma mensagem saiu da fila sem ser entregue.
 *
 * O enum de status tem só PENDENTE, ENVIADA e FALHOU, e nem toda saída é
 * falha: há mensagem que o próprio sistema decidiu não mandar. Sem status
 * próprio, o motivo fica no texto do `erro`, e estas marcas são o que separa
 * "o canal quebrou" de "nós mesmos descartamos".
 *
 * Moram aqui, e não em cada arquivo, porque a fila escreve a marca e o
 * sentinela a lê. Quando as duas pontas guardam a própria cópia da regra,
 * elas divergem — e divergiram: a fila passou a descartar mensagem vencida
 * sem marcar nada, e o sentinela ficou contando as sobras como "presas há
 * mais de 2h, a ponte pode estar fora do ar", todo dia, para sempre.
 */

/** Resumo de hoje torna o de ontem inútil — manda-se o novo, descarta-se o velho. */
export const MARCA_DESCARTE = "substituída por versão mais recente";

/**
 * Passou da validade antes de alguém vir buscar.
 *
 * Acontece quando a ponte fica fora do ar — no fim de semana de 03 e 04/10 de
 * 2026 não saiu nada — ou quando o teto diário por pessoa segura a mensagem
 * até ela envelhecer. Em ambos os casos o cliente não recebeu, e isso é
 * perda: a marca existe para a perda ficar registrada em vez de virar uma
 * linha PENDENTE eterna que ninguém lê.
 */
export const MARCA_EXPIRADA = "expirada sem entrega";

/**
 * As marcas que NÃO são falha de canal.
 *
 * Quem conta problema de operação precisa ignorar as duas; quem monta a fila
 * precisa ignorar as duas. Uma lista só, para não esquecer uma delas de um
 * lado quando a outra for criada.
 */
export const MARCAS_QUE_NAO_SAO_FALHA = [MARCA_DESCARTE, MARCA_EXPIRADA] as const;

/** Filtro Prisma: linhas cujo `erro` não é uma dessas marcas. */
export function ondeNaoFoiDescartada() {
  return {
    AND: MARCAS_QUE_NAO_SAO_FALHA.map((marca) => ({
      OR: [{ erro: null }, { NOT: { erro: { startsWith: marca } } }],
    })),
  };
}
