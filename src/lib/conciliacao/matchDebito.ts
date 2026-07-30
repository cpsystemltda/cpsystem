import "server-only";
import { prisma } from "@/lib/prisma";
import type { TipoContrapartidaDebito } from "@/generated/prisma/client";

// Match de DEBITOS: extrato negativo (o cliente pagou algo). Contrapartidas
// possiveis: mensalidade CP System, fixo mensal ao analista, comissao
// variavel ao analista. Regina 30/07 — semelhante ao match de credito mas
// com foco no que o cliente PAGOU no periodo do extrato.

export type CandidatoDebito = {
  tipoContrapartida: TipoContrapartidaDebito;
  contrapartidaId: string;
  score: number;
  fatores: {
    valorExato: boolean;
    valorProximo: boolean;
    datasDif: number | null;
    matchTextual: boolean;
  };
};

const SCORE_AUTO_CONFIRMA_DEBITO = 85;
const SCORE_SUGERIR_MIN_DEBITO = 50;

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

function diasDif(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / 86400000));
}

type Transacao = {
  data: Date;
  valor: number;
  descricao: string;
  nomeContraparte: string | null;
};

// Busca candidatos de DEBITO para uma transacao especifica. Retorna top 3.
export async function encontrarCandidatosDebito(
  contaId: string,
  transacao: Transacao,
): Promise<CandidatoDebito[]> {
  const [cobrancas, fixosPagos, comissoes] = await Promise.all([
    prisma.cobranca.findMany({
      where: {
        contaId,
        status: { in: ["PENDENTE", "PAGA"] },
      },
      select: { id: true, valor: true, vencimento: true, pagaEm: true, competencia: true },
    }),
    prisma.pagamentoFixoMensal.findMany({
      where: {
        vinculo: { contaId },
        status: { in: ["A_RECEBER", "ATRASADO", "PAGO_PARCIAL"] },
      },
      select: {
        id: true,
        valor: true,
        vencimento: true,
        competencia: true,
        vinculo: { select: { analista: { select: { nomeCompleto: true, cpf: true } } } },
      },
    }),
    prisma.comissaoExecucao.findMany({
      where: {
        vinculo: { contaId },
        status: { in: ["A_RECEBER", "ATRASADO", "PAGO_AGUARDANDO_CONFIRMACAO", "PAGO_PARCIAL"] },
      },
      select: {
        id: true,
        valorCalculado: true,
        valorRecebido: true,
        criadoEm: true,
        analista: { select: { nomeCompleto: true, cpf: true } },
        empenho: { select: { numero: true, orgaoNome: true } },
      },
    }),
  ]);

  const descNorm = norm(transacao.descricao);
  const contraNorm = norm(transacao.nomeContraparte);
  const candidatos: CandidatoDebito[] = [];

  // 1) Cobranca CP — texto tipico: "CONTRATOS PUBLICOS", "CP SYSTEM", "ASAAS"
  for (const c of cobrancas) {
    const valorTx = transacao.valor;
    const valorExato = Math.abs(valorTx - c.valor) < 0.01;
    const valorProximo = c.valor > 0 && Math.abs(valorTx - c.valor) / c.valor < 0.02;
    const dataRef = c.pagaEm ?? c.vencimento;
    const dif = diasDif(transacao.data, dataRef);
    const matchTextual =
      descNorm.includes("contratos publicos") ||
      descNorm.includes("cp system") ||
      descNorm.includes("cpsystem") ||
      descNorm.includes("asaas") ||
      contraNorm.includes("contratos publicos") ||
      contraNorm.includes("cp system");
    let score = 0;
    if (matchTextual) score += 45;
    if (valorExato) score += 35;
    else if (valorProximo) score += 20;
    if (dif <= 5) score += 20;
    else if (dif <= 15) score += 10;
    if (score >= 30) {
      candidatos.push({
        tipoContrapartida: "COBRANCA_CP",
        contrapartidaId: c.id,
        score: Math.min(100, score),
        fatores: { valorExato, valorProximo, datasDif: dif, matchTextual },
      });
    }
  }

  // 2) Fixo mensal ao analista — texto tipico: nome/CPF do analista
  for (const f of fixosPagos) {
    if (!f.vencimento) continue;
    const valorExato = Math.abs(transacao.valor - f.valor) < 0.01;
    const valorProximo = f.valor > 0 && Math.abs(transacao.valor - f.valor) / f.valor < 0.02;
    const dif = diasDif(transacao.data, f.vencimento);
    const nomeAn = norm(f.vinculo.analista.nomeCompleto);
    const cpfAn = f.vinculo.analista.cpf.replace(/\D/g, "");
    const matchTextual =
      (nomeAn && (descNorm.includes(nomeAn) || contraNorm.includes(nomeAn))) ||
      (cpfAn && (transacao.descricao.replace(/\D/g, "").includes(cpfAn) || (transacao.nomeContraparte ?? "").replace(/\D/g, "").includes(cpfAn)));
    let score = 0;
    if (matchTextual) score += 50;
    if (valorExato) score += 30;
    else if (valorProximo) score += 15;
    if (dif <= 5) score += 15;
    else if (dif <= 15) score += 5;
    if (score >= 30) {
      candidatos.push({
        tipoContrapartida: "FIXO_ANALISTA",
        contrapartidaId: f.id,
        score: Math.min(100, score),
        fatores: {
          valorExato,
          valorProximo,
          datasDif: dif,
          matchTextual: Boolean(matchTextual),
        },
      });
    }
  }

  // 3) Comissao variavel ao analista — nome/CPF analista + valor comissao
  for (const c of comissoes) {
    const valorRestante = c.valorCalculado - c.valorRecebido;
    if (valorRestante <= 0) continue;
    const valorExato = Math.abs(transacao.valor - valorRestante) < 0.01;
    const valorProximo =
      valorRestante > 0 && Math.abs(transacao.valor - valorRestante) / valorRestante < 0.03;
    const dif = diasDif(transacao.data, c.criadoEm);
    const nomeAn = norm(c.analista.nomeCompleto);
    const cpfAn = c.analista.cpf.replace(/\D/g, "");
    const matchTextual =
      (nomeAn && (descNorm.includes(nomeAn) || contraNorm.includes(nomeAn))) ||
      (cpfAn && (transacao.descricao.replace(/\D/g, "").includes(cpfAn) || (transacao.nomeContraparte ?? "").replace(/\D/g, "").includes(cpfAn)));
    let score = 0;
    if (matchTextual) score += 55;
    if (valorExato) score += 35;
    else if (valorProximo) score += 15;
    if (dif <= 60) score += 5; // comissao pode demorar até 60d pra ser paga
    if (score >= 30) {
      candidatos.push({
        tipoContrapartida: "COMISSAO_ANALISTA",
        contrapartidaId: c.id,
        score: Math.min(100, score),
        fatores: {
          valorExato,
          valorProximo,
          datasDif: dif,
          matchTextual: Boolean(matchTextual),
        },
      });
    }
  }

  return candidatos.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function classificarScoreDebito(score: number): "alto" | "medio" | "baixo" {
  if (score >= SCORE_AUTO_CONFIRMA_DEBITO) return "alto";
  if (score >= SCORE_SUGERIR_MIN_DEBITO) return "medio";
  return "baixo";
}

export { SCORE_AUTO_CONFIRMA_DEBITO, SCORE_SUGERIR_MIN_DEBITO };
