/**
 * Traduz o `fatoresMatch` gravado pelo motor (`match.ts`) em frases curtas.
 *
 * C2VENDAS, follow-up de 06/11/2026: a empresa faz muitas entregas parciais e
 * não entendeu o "% de match" — um número sozinho não diz POR QUE a máquina
 * casou aquele crédito com aquele empenho. As frases dizem: CNPJ igual, valor
 * exato, órgão igual, quantos dias de diferença. Com isso a pessoa confere em
 * vez de confiar.
 *
 * Puro, sem dependência de servidor: é usado em componente de cliente.
 */
export function fatoresLegiveis(bruto: unknown): string[] {
  if (!bruto || typeof bruto !== "object") return [];
  const f = bruto as Record<string, unknown>;
  const frases: string[] = [];
  if (f.cnpjIgual === true) frases.push("CNPJ do órgão igual");
  if (f.valorExato === true) frases.push("valor exato");
  else if (f.valorProximo === true) frases.push("valor próximo");
  if (f.orgaoIgual === true) frases.push("órgão igual");
  else if (f.orgaoParcial === true) frases.push("nome do órgão parecido");
  if (typeof f.datasDif === "number") {
    const d = Math.abs(Math.round(f.datasDif));
    frases.push(d === 0 ? "mesma data" : `${d} dia${d === 1 ? "" : "s"} de diferença na data`);
  }
  return frases;
}
