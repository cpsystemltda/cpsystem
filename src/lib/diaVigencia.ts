import "server-only";

/**
 * Vigência é DATA, não instante.
 *
 * Regina, 24/09/2026: *"por que o painel do meu cliente está completamente
 * apagado se ele já cadastrou contratos e empenhos?"* A ata da C2Vendas tinha
 * 26 itens e R$ 175.469,09, com vigência até **24/09 — aquele mesmo dia**. O
 * dashboard comparava `vigenciaFim >= new Date()`, ou seja, contra o INSTANTE
 * atual. A vigência está gravada em 24/09 às 00:00, então a partir de
 * 00:00:01 a ata já contava como vencida — e, como todos os valores do painel
 * derivam das atas e contratos vigentes, o cliente apareceu zerado no último
 * dia de vigência, justamente quando mais precisava olhar.
 *
 * Documento que vale "até 24/09" vale o dia 24 inteiro. Quem decide é o dia,
 * nunca a hora — a mesma lição do bug do D-1 em `parseDataInputBr`.
 *
 * Usar este valor em TODA comparação de vigência. É o corte único: enquanto
 * cada tela calculava o seu, bastava uma esquecer para o cliente ver número
 * diferente em duas páginas do mesmo sistema.
 */
export function inicioDoDiaVigencia(agora: Date = new Date()): Date {
  const d = new Date(agora);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
