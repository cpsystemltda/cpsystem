/**
 * Texto pronto pra mandar à contabilidade pedindo a nota do empenho.
 *
 * Vive num módulo PURO, sem `server-only` e sem Prisma, de propósito: a página
 * de execução é server component mas carrega vários componentes de cliente, e
 * importar um módulo server-only ali quebrava a hidratação da página inteira —
 * nenhum botão respondia. Formatação de texto não precisa de servidor.
 */

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarCnpj(cnpj: string): string {
  const d = (cnpj || "").replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function blocoParaContabilidade(e: {
  numero: string;
  orgaoNome: string;
  orgaoCnpj: string;
  processoAdministrativo: string | null;
  empresaRazaoSocial: string;
  empresaCnpj: string;
  dataEntrega: Date | null;
  itens: { descricao: string; quantidade: number; unidade: string; valorTotal: number }[];
}): string {
  const total = e.itens.reduce((s, i) => s + i.valorTotal, 0);
  const linhas = e.itens.map(
    (i) => `• ${i.descricao} — ${i.quantidade} ${i.unidade} — ${brl(i.valorTotal)}`,
  );
  return [
    `Solicitação de nota fiscal`,
    ``,
    `Prestador: ${e.empresaRazaoSocial} — CNPJ ${formatarCnpj(e.empresaCnpj)}`,
    `Tomador: ${e.orgaoNome} — CNPJ ${formatarCnpj(e.orgaoCnpj)}`,
    e.processoAdministrativo ? `Processo: ${e.processoAdministrativo}` : null,
    `Empenho: ${e.numero}`,
    e.dataEntrega ? `Entrega: ${e.dataEntrega.toLocaleDateString("pt-BR")}` : null,
    ``,
    `Itens:`,
    ...linhas,
    ``,
    `Valor total: ${brl(total)}`,
    ``,
    `Observação: tomador é órgão público — confirmar retenções aplicáveis e, se`,
    `for o caso, a declaração de optante pelo Simples Nacional.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
