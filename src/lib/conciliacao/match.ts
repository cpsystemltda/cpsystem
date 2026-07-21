import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Motor de match entre transacao bancaria (credito) e empenho aberto.
// Regina 21/07/2026: score 0-100 baseado em (valor, data, orgao, cnpj).
// Threshold: >85 auto, 50-85 sugere, <50 fraca.

export type FatoresMatch = {
  valorExato: boolean;
  valorProximo: boolean;    // dif <= 1%
  datasDif: number | null;  // dias entre transacao e vencimento/emissao NF
  orgaoIgual: boolean;
  orgaoParcial: boolean;
  cnpjIgual: boolean;
};

export type CandidatoMatch = {
  empenhoId: string;
  score: number;
  fatores: FatoresMatch;
};

type EmpenhoBasico = {
  id: string;
  orgaoNome: string;
  orgaoCnpj: string;
  itens: Array<{ valorTotal: number }>;
  dataNfEmitida: Date | null;
  dataNfEncaminhada: Date | null;
  vigenciaFim: Date | null;
};

// Normaliza string pra comparacao: minusculas, sem acentos, sem pontuacao
function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normCnpj(c: string | null | undefined): string {
  if (!c) return "";
  return c.replace(/\D/g, "");
}

// Calcula quantos dias absolutos entre 2 datas.
function diasDif(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / 86400000));
}

// Score de match entre 1 transacao e 1 empenho.
export function scorarCandidato(
  transacao: {
    data: Date;
    valor: number;
    nomeContraparte: string | null;
    cnpjContraparte: string | null;
    descricao: string;
  },
  empenho: EmpenhoBasico,
): CandidatoMatch {
  const valorEmpenho = empenho.itens.reduce((s, i) => s + i.valorTotal, 0);
  const dataRef = empenho.dataNfEncaminhada ?? empenho.dataNfEmitida ?? empenho.vigenciaFim;

  const fatores: FatoresMatch = {
    valorExato: Math.abs(transacao.valor - valorEmpenho) < 0.01,
    valorProximo: valorEmpenho > 0 && Math.abs(transacao.valor - valorEmpenho) / valorEmpenho < 0.01,
    datasDif: dataRef ? diasDif(transacao.data, dataRef) : null,
    orgaoIgual: false,
    orgaoParcial: false,
    cnpjIgual: false,
  };

  // Compara orgao
  const orgaoNorm = norm(empenho.orgaoNome);
  const contraparteNorm = norm(transacao.nomeContraparte);
  const descNorm = norm(transacao.descricao);
  if (orgaoNorm && contraparteNorm && orgaoNorm === contraparteNorm) {
    fatores.orgaoIgual = true;
  } else if (orgaoNorm && (contraparteNorm.includes(orgaoNorm) || descNorm.includes(orgaoNorm))) {
    fatores.orgaoParcial = true;
  } else if (orgaoNorm) {
    // Match por primeiras 2 palavras significativas (ex: "MINISTERIO DA FAZENDA" ~ "MIN FAZENDA")
    const palavrasOrgao = orgaoNorm.split(" ").filter((p) => p.length > 3).slice(0, 2);
    if (palavrasOrgao.length >= 1 && palavrasOrgao.every((p) => contraparteNorm.includes(p) || descNorm.includes(p))) {
      fatores.orgaoParcial = true;
    }
  }

  // Compara CNPJ
  const cnpjEmp = normCnpj(empenho.orgaoCnpj);
  const cnpjTx = normCnpj(transacao.cnpjContraparte);
  if (cnpjEmp && cnpjTx && cnpjEmp === cnpjTx) fatores.cnpjIgual = true;

  // Score:
  //  - CNPJ igual: match quase certo (+50)
  //  - Valor exato: +30 (proximo: +20)
  //  - Órgão igual: +20 (parcial: +10)
  //  - Data proxima ate 5d: +10 (ate 15d: +5)
  let score = 0;
  if (fatores.cnpjIgual) score += 50;
  if (fatores.valorExato) score += 30;
  else if (fatores.valorProximo) score += 20;
  if (fatores.orgaoIgual) score += 20;
  else if (fatores.orgaoParcial) score += 10;
  if (fatores.datasDif !== null) {
    if (fatores.datasDif <= 5) score += 10;
    else if (fatores.datasDif <= 15) score += 5;
  }
  score = Math.min(100, score);

  return { empenhoId: empenho.id, score, fatores };
}

// Busca melhores candidatos para uma transacao entre os empenhos abertos
// de uma conta. Retorna top 3 ordenados por score decrescente.
export async function encontrarCandidatos(
  contaId: string,
  transacao: {
    data: Date;
    valor: number;
    nomeContraparte: string | null;
    cnpjContraparte: string | null;
    descricao: string;
  },
): Promise<CandidatoMatch[]> {
  // Busca empenhos da conta que ainda nao estao PAGO
  const empenhos = await prisma.empenho.findMany({
    where: {
      empresa: { contaId },
      status: { in: ["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO", "ENTREGUE", "NF_EMITIDA", "NF_ENCAMINHADA"] },
    },
    select: {
      id: true,
      orgaoNome: true,
      orgaoCnpj: true,
      dataNfEmitida: true,
      dataNfEncaminhada: true,
      vigenciaFim: true,
      itens: { select: { valorTotal: true } },
    },
  });

  const candidatos = empenhos
    .map((e) => scorarCandidato(transacao, e))
    .filter((c) => c.score >= 30) // corta ruido total
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return candidatos;
}

// Threshold: >= 85 auto-confirma. Caller decide o resto.
export const SCORE_AUTO_CONFIRMA = 85;
export const SCORE_SUGERIR_MIN = 50;

// Classifica pra estatística (dashboard)
export function classificarScore(score: number): "alto" | "medio" | "baixo" {
  if (score >= SCORE_AUTO_CONFIRMA) return "alto";
  if (score >= SCORE_SUGERIR_MIN) return "medio";
  return "baixo";
}
