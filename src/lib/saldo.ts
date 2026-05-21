import { prisma } from "@/lib/prisma";

export type SaldoItem = {
  ataItemId: string;
  descricao: string;
  unidade: string;
  marca: string | null;
  lote: string | null;
  numero: string | null;
  quantidadeTotal: number;
  quantidadeUsada: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
};

export type SaldoAta = {
  itens: SaldoItem[];
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
  percentualUsado: number;
};

// Saldo de uma Ata = soma dos itens, descontando ContratoItem (todos)
// e EmpenhoItem que NÃO estão dentro de um Contrato (pra não contar duas vezes).
export async function calcularSaldoAta(ataId: string): Promise<SaldoAta> {
  const itens = await prisma.ataItem.findMany({
    where: { ataId },
    include: {
      contratoItens: { select: { quantidade: true } },
      empenhoItens: {
        select: { quantidade: true, empenho: { select: { contratoId: true } } },
      },
    },
    orderBy: { id: "asc" },
  });

  const out: SaldoItem[] = itens.map((it) => {
    const usadoContrato = it.contratoItens.reduce((s, c) => s + c.quantidade, 0);
    const usadoEmpenhoSolto = it.empenhoItens
      .filter((e) => e.empenho.contratoId === null)
      .reduce((s, e) => s + e.quantidade, 0);
    const usado = usadoContrato + usadoEmpenhoSolto;
    const disponivel = Math.max(0, it.quantidade - usado);

    return {
      ataItemId: it.id,
      descricao: it.descricao,
      unidade: it.unidade,
      marca: it.marca ?? null,
      lote: it.lote ?? null,
      numero: it.numero ?? null,
      quantidadeTotal: it.quantidade,
      quantidadeUsada: usado,
      quantidadeDisponivel: disponivel,
      valorUnitario: it.valorUnitario,
      valorTotal: it.valorTotal,
      valorUsado: usado * it.valorUnitario,
      valorDisponivel: disponivel * it.valorUnitario,
    };
  });

  const valorTotal = out.reduce((s, i) => s + i.valorTotal, 0);
  const valorUsado = out.reduce((s, i) => s + i.valorUsado, 0);
  const valorDisponivel = valorTotal - valorUsado;

  return {
    itens: out,
    valorTotal,
    valorUsado,
    valorDisponivel,
    percentualUsado: valorTotal === 0 ? 0 : (valorUsado / valorTotal) * 100,
  };
}

// Normaliza descrição pra match tolerante:
// - trim de espaços nas pontas
// - case-insensitive
// - remove pontuação no final (. , ;)
// - colapsa whitespace múltiplo
// - remove plural -s final de cada palavra (>3 chars) — pra "Equipamentos"
//   bater com "Equipamento" (singular vs plural é diferença comum em
//   empenhos digitados manualmente)
// Necessário porque empenhos digitados manualmente acabam com micro-
// diferenças que faziam o match strict não bater → quantidades não
// eram descontadas.
function normalizarDescricao(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;]+$/, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((p) => (p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p))
    .join(" ");
}

// Saldo de um Contrato (não-SRP ou derivado): quanto já foi empenhado/executado.
// EmpenhoItem se conecta a ContratoItem via ataItemId (ambos apontam pro mesmo AtaItem
// quando o contrato derivou de uma Ata) ou ao Empenho.contratoId quando o contrato é direto.
export async function calcularSaldoContrato(contratoId: string) {
  const itens = await prisma.contratoItem.findMany({
    where: { contratoId },
    orderBy: { id: "asc" },
  });

  const empenhoItens = await prisma.empenhoItem.findMany({
    where: { empenho: { contratoId } },
    select: { quantidade: true, ataItemId: true, descricao: true },
  });

  const linhas = itens.map((it) => {
    const descContratoNorm = normalizarDescricao(it.descricao);
    const usado = empenhoItens
      .filter((e) =>
        (it.ataItemId && e.ataItemId === it.ataItemId) ||
        normalizarDescricao(e.descricao) === descContratoNorm,
      )
      .reduce((s, e) => s + e.quantidade, 0);
    const disponivel = Math.max(0, it.quantidade - usado);
    return {
      contratoItemId: it.id,
      descricao: it.descricao,
      unidade: it.unidade,
      quantidadeTotal: it.quantidade,
      quantidadeUsada: usado,
      quantidadeDisponivel: disponivel,
      valorUnitario: it.valorUnitario,
      valorTotal: it.valorTotal,
      valorUsado: usado * it.valorUnitario,
      valorDisponivel: disponivel * it.valorUnitario,
    };
  });

  const valorTotal = linhas.reduce((s, i) => s + i.valorTotal, 0);
  const valorUsado = linhas.reduce((s, i) => s + i.valorUsado, 0);

  return {
    itens: linhas,
    valorTotal,
    valorUsado,
    valorDisponivel: valorTotal - valorUsado,
    percentualUsado: valorTotal === 0 ? 0 : (valorUsado / valorTotal) * 100,
  };
}
