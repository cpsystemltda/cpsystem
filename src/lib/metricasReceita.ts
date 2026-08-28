import { PRECO_BASE } from "@/lib/precosConstants";
import type { Plano } from "@/lib/gateway";

/**
 * Regra única de "quanto o CP System recebe por mês".
 *
 * Regina 28/08, olhando o Painel do Proprietário marcar R$ 794 de MRR: "a
 * gente só tem um cliente realmente pagando hoje... tem que ser muito
 * assertiva, senão você vai gerar confusão na nossa visão de caixa".
 *
 * O número estava errado por três motivos somados, e cada tela errava de um
 * jeito diferente — havia QUATRO contas de MRR no sistema, nenhuma igual à
 * outra:
 *
 * 1. A conta do analista entrava como receita. Analista não paga assinatura:
 *    ele RECEBE comissão. Contá-lo inverte o sinal do dinheiro.
 * 2. Bastava a conta estar marcada ATIVA pra virar receita, mesmo sem nunca
 *    ter pago fatura nenhuma. Status é intenção; caixa é fatura paga.
 * 3. O preço vinha de `plano === "PREMIUM" ? 997 : 397`, então conta do plano
 *    INTERMEDIÁRIO (R$ 697) era contada como R$ 397 — e no Painel do PO o mapa
 *    de preços nem tinha o Intermediário, o que daria NaN no MRR inteiro.
 *
 * A regra agora é uma só, e é conservadora de propósito: entra no MRR quem é
 * EMPRESA, não é conta interna do CP System, está ATIVA e já pagou pelo menos
 * uma fatura. E o valor é o da fatura de verdade — que é onde aparecem CNPJ
 * adicional, colaborador extra e cupom — caindo pro preço de tabela só quando
 * não há fatura com valor.
 */

export type CobrancaParaReceita = {
  status: string;
  valor: number;
  pagaEm?: Date | null;
  vencimento?: Date | null;
};

export type ContaParaReceita = {
  tipo: string;
  statusAssinatura: string;
  plano: string;
  usuarios?: { superAdmin?: boolean | null }[];
  cobrancas?: CobrancaParaReceita[];
};

/** Conta interna do CP System (Regina/Igor) — existe pra operar, nunca paga. */
export function ehContaInterna(c: ContaParaReceita): boolean {
  return (c.usuarios ?? []).some((u) => u.superAdmin === true);
}

/** Já pagou pelo menos uma fatura? É isso que separa cliente de cadastro. */
export function jaPagouAlgumaVez(c: ContaParaReceita): boolean {
  return (c.cobrancas ?? []).some((cb) => cb.status === "PAGA");
}

/**
 * Entra no MRR? EMPRESA + não interna + ATIVA + com fatura paga.
 *
 * Cliente novo cuja primeira fatura ainda está pendente fica de fora de
 * propósito: ele é receita provável, não receita realizada, e misturar os dois
 * é exatamente o que embaralha a visão de caixa.
 */
export function contaEhPagante(c: ContaParaReceita): boolean {
  return (
    c.tipo === "EMPRESA" &&
    !ehContaInterna(c) &&
    c.statusAssinatura === "ATIVA" &&
    jaPagouAlgumaVez(c)
  );
}

/**
 * Mensalidade real da conta: valor da última fatura paga (que já traz cupom e
 * adicionais), com o preço de tabela do plano como último recurso.
 */
export function mensalidadeDaConta(c: ContaParaReceita): number {
  const pagas = (c.cobrancas ?? []).filter((cb) => cb.status === "PAGA" && cb.valor > 0);
  if (pagas.length > 0) {
    const maisRecente = [...pagas].sort((a, b) => {
      const da = a.pagaEm?.getTime() ?? a.vencimento?.getTime() ?? 0;
      const db = b.pagaEm?.getTime() ?? b.vencimento?.getTime() ?? 0;
      return db - da;
    })[0];
    return maisRecente.valor;
  }
  return PRECO_BASE[c.plano as Plano] ?? 0;
}

export type ResumoReceita = {
  mrr: number;
  arr: number;
  pagantes: ContaParaReceita[];
  ticketMedio: number;
  /** ATIVAS que ainda não pagaram nenhuma fatura — receita esperada, não caixa. */
  ativasSemPagamento: ContaParaReceita[];
};

export function resumoReceita(contas: ContaParaReceita[]): ResumoReceita {
  const pagantes = contas.filter(contaEhPagante);
  const mrr = pagantes.reduce((s, c) => s + mensalidadeDaConta(c), 0);
  const ativasSemPagamento = contas.filter(
    (c) =>
      c.tipo === "EMPRESA" &&
      !ehContaInterna(c) &&
      c.statusAssinatura === "ATIVA" &&
      !jaPagouAlgumaVez(c),
  );
  return {
    mrr,
    arr: mrr * 12,
    pagantes,
    ticketMedio: pagantes.length > 0 ? mrr / pagantes.length : 0,
    ativasSemPagamento,
  };
}
