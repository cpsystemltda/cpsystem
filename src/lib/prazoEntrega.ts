// Calculo do prazo-limite de entrega de um empenho. Centralizado aqui
// porque essa logica precisa bater em todo lugar: pagina de detalhe
// (alerta de atraso/timeline), dashboard de Logistica (ordenacao por
// "data limite"), agenda da semana. Bug Regina 09/06: dashboard estava
// caindo no fallback vigenciaFim e mostrava 14/07 num empenho com
// dataEntregaCerta = 16/06.

export type PrazoEntregaModo = "RELATIVO" | "DATA_CERTA" | "PRAZO_CERTO" | "SOB_DEMANDA";
export type PrazoEntregaUnidade = "DIAS" | "MESES" | "ANOS";

export type EmpenhoParaPrazoEntrega = {
  prazoEntregaModo: PrazoEntregaModo;
  dataEntregaCerta: Date | null;
  dataEntregaInicio: Date | null;
  dataEntregaFim: Date | null;
  dataPedidoRecebido: Date | null;
  prazoEntregaDias: number | null;
  prazoEntregaUnidade: PrazoEntregaUnidade;
};

const FATOR_DIAS: Record<PrazoEntregaUnidade, number> = {
  DIAS: 1,
  MESES: 30,
  ANOS: 365,
};

/**
 * Prazo-limite tempestivo *real* do empenho, derivado do modo:
 *  - DATA_CERTA   -> dataEntregaCerta
 *  - PRAZO_CERTO  -> dataEntregaFim
 *  - RELATIVO     -> dataPedidoRecebido + prazoEntregaDias (* 30 se em MESES)
 *  - SOB_DEMANDA  -> null
 *
 * Retorna null quando ainda nao da pra determinar (ex.: RELATIVO sem pedido
 * recebido). A pagina de detalhe usa isso pra esconder o alerta de prazo
 * ate o pedido entrar.
 */
export function calcularPrazoLimiteEntrega(e: EmpenhoParaPrazoEntrega): Date | null {
  if (e.prazoEntregaModo === "DATA_CERTA") {
    return e.dataEntregaCerta ?? null;
  }
  if (e.prazoEntregaModo === "PRAZO_CERTO") {
    return e.dataEntregaFim ?? null;
  }
  if (e.prazoEntregaModo === "RELATIVO") {
    if (!e.dataPedidoRecebido || !e.prazoEntregaDias) return null;
    const fator = FATOR_DIAS[e.prazoEntregaUnidade];
    return new Date(e.dataPedidoRecebido.getTime() + e.prazoEntregaDias * fator * 86400000);
  }
  return null;
}

/**
 * Versao "garantida" pra contextos onde precisamos ordenar SEMPRE por uma
 * data (tabela do dashboard, agenda). Cai pra dataPrevistaExecucao
 * (pre-cadastro manual) e depois vigenciaFim como ultimo recurso.
 */
export function prazoLimiteOuVigencia(
  e: EmpenhoParaPrazoEntrega & { dataPrevistaExecucao: Date | null; vigenciaFim: Date },
): Date {
  return calcularPrazoLimiteEntrega(e) ?? e.dataPrevistaExecucao ?? e.vigenciaFim;
}

/**
 * Janela de execucao do empenho (data inicio -> data fim). Usada pelo
 * calendario/agenda pra replicar o mesmo evento em TODOS os dias do
 * intervalo. Bug Igor 26/06: empenho com dataEntregaInicio=26 e
 * dataEntregaFim=27 so aparecia no dia 27 porque a agenda usava 1 data
 * unica (prazoLimiteOuVigencia).
 *
 * - PRAZO_CERTO com inicio+fim: usa o intervalo cheio.
 * - Resto dos modos: janela degenerada (mesmo dia inicio=fim) baseada
 *   em prazoLimiteOuVigencia.
 *
 * Retorna SEMPRE inicio <= fim. Datas com hora zerada (00:00).
 */
export function janelaExecucao(
  e: EmpenhoParaPrazoEntrega & { dataPrevistaExecucao: Date | null; vigenciaFim: Date },
): { inicio: Date; fim: Date } {
  const zerarHora = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
  };

  if (e.prazoEntregaModo === "PRAZO_CERTO" && e.dataEntregaInicio && e.dataEntregaFim) {
    const ini = zerarHora(e.dataEntregaInicio);
    const fim = zerarHora(e.dataEntregaFim);
    return ini <= fim ? { inicio: ini, fim } : { inicio: fim, fim: ini };
  }

  const limite = zerarHora(prazoLimiteOuVigencia(e));
  return { inicio: limite, fim: limite };
}
