import { prisma } from "@/lib/prisma";

export type SaldoItem = {
  // Item da Ata — id no campo ataItemId.
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

// Item de Contrato — id no campo contratoItemId. Estrutura espelha
// SaldoItem mas com nome de id distinto pra que ItensContratoTab e
// ItensAtaTab tipem corretamente.
export type SaldoItemContrato = {
  contratoItemId: string;
  descricao: string;
  unidade: string;
  quantidadeTotal: number;
  quantidadeUsada: number;
  quantidadeDisponivel: number;
  valorUnitario: number;
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
};

type SaldoVigenciaBase = {
  vigenciaId: string;
  ordem: number;
  dataInicio: Date;
  dataFim: Date;
  status: "ATIVA" | "ENCERRADA" | "FUTURA";
  termoAditivoId: string | null;
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
  percentualUsado: number;
};

export type SaldoVigencia = SaldoVigenciaBase & { itens: SaldoItem[] };
export type SaldoVigenciaContrato = SaldoVigenciaBase & {
  itens: SaldoItemContrato[];
};

// Campos "legacy" (itens, valorTotal, valorUsado, valorDisponivel,
// percentualUsado) espelham a vigência atual — assim a UI existente
// continua funcionando sem mudança. Os campos novos (vigencias,
// vigenciaAtual, acumulado) ficam disponíveis pra UI da Phase 4.
export type SaldoAta = {
  // Legacy (vigência atual):
  itens: SaldoItem[];
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
  percentualUsado: number;
  // Novos:
  vigenciaAtual: SaldoVigencia | null;
  vigencias: SaldoVigencia[];
  acumulado: {
    valorTotal: number;
    valorUsado: number;
    valorDisponivel: number;
  };
};

export type SaldoContrato = {
  // Legacy:
  itens: SaldoItemContrato[];
  valorTotal: number;
  valorUsado: number;
  valorDisponivel: number;
  percentualUsado: number;
  // Novos:
  vigenciaAtual: SaldoVigenciaContrato | null;
  vigencias: SaldoVigenciaContrato[];
  acumulado: {
    valorTotal: number;
    valorUsado: number;
    valorDisponivel: number;
  };
};

// Determina status de uma vigência relativo a "hoje":
// - ATIVA: hoje está dentro do intervalo
// - ENCERRADA: dataFim < hoje
// - FUTURA: dataInicio > hoje
function classificarStatus(
  inicio: Date,
  fim: Date,
  agora: Date = new Date(),
): "ATIVA" | "ENCERRADA" | "FUTURA" {
  if (fim < agora) return "ENCERRADA";
  if (inicio > agora) return "FUTURA";
  return "ATIVA";
}

// Escolhe a vigência "atual" — preferência:
// 1. A única classificada ATIVA
// 2. Se múltiplas ATIVAS (raro, mas possível por overlap), a de maior ordem
// 3. Se nenhuma ATIVA (todas ENCERRADAS ou todas FUTURAS), a última criada
//    (maior ordem) — pra contratos vencidos, mostra a última executada.
function escolherVigenciaAtual<T extends { ordem: number; status: string }>(
  vigs: T[],
): T | null {
  if (vigs.length === 0) return null;
  const ativas = vigs.filter((v) => v.status === "ATIVA");
  if (ativas.length > 0) {
    return ativas.reduce((a, b) => (a.ordem >= b.ordem ? a : b));
  }
  return vigs.reduce((a, b) => (a.ordem >= b.ordem ? a : b));
}

// Saldo de uma Ata por vigência. Cada vigência tem seus itens próprios
// (após Phase 3: novo aditivo cria nova vigência com itens próprios).
// Empenhos de uma vigência abatem só dela — não cumula com a próxima.
//
// Fallback de descrição (empenhoItem.ataItemId NULL): match por descrição
// normalizada APENAS dentro da mesma vigência (não vaza entre vigências).
export async function calcularSaldoAta(ataId: string): Promise<SaldoAta> {
  const vigencias = await prisma.vigencia.findMany({
    where: { ataId },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      ordem: true,
      dataInicio: true,
      dataFim: true,
      termoAditivoId: true,
    },
  });

  // Edge case: Ata sem vigência (não deveria acontecer pós-backfill, mas
  // tratamos por segurança — usa todos os itens da ata como se fosse
  // uma única vigência virtual).
  if (vigencias.length === 0) {
    return calcularSaldoAtaLegacy(ataId);
  }

  const itensTodos = await prisma.ataItem.findMany({
    where: { ataId },
    include: {
      contratoItens: {
        select: { quantidade: true, valorTotal: true, vigenciaId: true, contrato: { select: { vigencias: { select: { id: true } } } } },
      },
      empenhoItens: {
        select: {
          quantidade: true,
          valorTotal: true,
          empenho: { select: { contratoId: true, vigenciaId: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  // Empenho itens órfãos (ataItemId NULL) — agrupados por vigenciaId pra
  // não vazar entre vigências.
  const empenhoItensOrfaosPorVig = await prisma.empenhoItem.findMany({
    where: {
      ataItemId: null,
      empenho: { ataId, contratoId: null },
    },
    select: {
      quantidade: true,
      valorTotal: true,
      descricao: true,
      empenho: { select: { vigenciaId: true } },
    },
  });

  const saldosPorVig: SaldoVigencia[] = vigencias.map((vig) => {
    const itensDaVig = itensTodos.filter((it) => it.vigenciaId === vig.id);

    const itensSaldo: SaldoItem[] = itensDaVig.map((it) => {
      // Quantidades (consumo via contrato derivado + empenho direto + órfão)
      const usadoContrato = it.contratoItens
        .filter((c) => c.vigenciaId === vig.id)
        .reduce((s, c) => s + c.quantidade, 0);
      const usadoEmpenhoSolto = it.empenhoItens
        .filter(
          (e) => e.empenho.contratoId === null && e.empenho.vigenciaId === vig.id,
        )
        .reduce((s, e) => s + e.quantidade, 0);
      const descItemNorm = normalizarDescricao(it.descricao);
      const usadoOrfaos = empenhoItensOrfaosPorVig
        .filter(
          (e) =>
            e.empenho.vigenciaId === vig.id &&
            normalizarDescricao(e.descricao) === descItemNorm,
        )
        .reduce((s, e) => s + e.quantidade, 0);
      const usado = usadoContrato + usadoEmpenhoSolto + usadoOrfaos;
      const disponivel = Math.max(0, it.quantidade - usado);

      // Valores: valorUsado é a soma dos VALORES CONGELADOS (snapshot do
      // momento da execução) — não recalcula com valorUnitario atual.
      // Decisão Regina: reajuste retroativo não infla o "já executado".
      // Usuário aplica reajuste à execução manualmente quando devido.
      const valorUsadoContrato = it.contratoItens
        .filter((c) => c.vigenciaId === vig.id)
        .reduce((s, c) => s + c.valorTotal, 0);
      const valorUsadoEmpenhoSolto = it.empenhoItens
        .filter(
          (e) => e.empenho.contratoId === null && e.empenho.vigenciaId === vig.id,
        )
        .reduce((s, e) => s + e.valorTotal, 0);
      const valorUsadoOrfaos = empenhoItensOrfaosPorVig
        .filter(
          (e) =>
            e.empenho.vigenciaId === vig.id &&
            normalizarDescricao(e.descricao) === descItemNorm,
        )
        .reduce((s, e) => s + e.valorTotal, 0);
      const valorUsado = valorUsadoContrato + valorUsadoEmpenhoSolto + valorUsadoOrfaos;

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
        valorUsado,
        valorDisponivel: disponivel * it.valorUnitario,
      };
    });

    const valorTotal = itensSaldo.reduce((s, i) => s + i.valorTotal, 0);
    const valorUsado = itensSaldo.reduce((s, i) => s + i.valorUsado, 0);

    return {
      vigenciaId: vig.id,
      ordem: vig.ordem,
      dataInicio: vig.dataInicio,
      dataFim: vig.dataFim,
      status: classificarStatus(vig.dataInicio, vig.dataFim),
      termoAditivoId: vig.termoAditivoId,
      itens: itensSaldo,
      valorTotal,
      valorUsado,
      valorDisponivel: valorTotal - valorUsado,
      percentualUsado: valorTotal === 0 ? 0 : (valorUsado / valorTotal) * 100,
    };
  });

  const vigenciaAtual = escolherVigenciaAtual(saldosPorVig);
  const acumulado = {
    valorTotal: saldosPorVig.reduce((s, v) => s + v.valorTotal, 0),
    valorUsado: saldosPorVig.reduce((s, v) => s + v.valorUsado, 0),
    valorDisponivel: saldosPorVig.reduce((s, v) => s + v.valorDisponivel, 0),
  };

  return {
    itens: vigenciaAtual?.itens ?? [],
    valorTotal: vigenciaAtual?.valorTotal ?? 0,
    valorUsado: vigenciaAtual?.valorUsado ?? 0,
    valorDisponivel: vigenciaAtual?.valorDisponivel ?? 0,
    percentualUsado: vigenciaAtual?.percentualUsado ?? 0,
    vigenciaAtual,
    vigencias: saldosPorVig,
    acumulado,
  };
}

// Fallback pra atas sem vigência (não deveria existir pós-backfill).
// Computa saldo como antes, sem distinguir vigência.
async function calcularSaldoAtaLegacy(ataId: string): Promise<SaldoAta> {
  const itens = await prisma.ataItem.findMany({
    where: { ataId },
    include: {
      contratoItens: { select: { quantidade: true, valorTotal: true } },
      empenhoItens: {
        select: { quantidade: true, valorTotal: true, empenho: { select: { contratoId: true } } },
      },
    },
    orderBy: { id: "asc" },
  });

  const empenhoItensOrfaos = await prisma.empenhoItem.findMany({
    where: {
      ataItemId: null,
      empenho: { ataId, contratoId: null },
    },
    select: { quantidade: true, valorTotal: true, descricao: true },
  });

  const out: SaldoItem[] = itens.map((it) => {
    const usadoContrato = it.contratoItens.reduce((s, c) => s + c.quantidade, 0);
    const usadoEmpenhoSolto = it.empenhoItens
      .filter((e) => e.empenho.contratoId === null)
      .reduce((s, e) => s + e.quantidade, 0);
    const descItemNorm = normalizarDescricao(it.descricao);
    const usadoOrfaos = empenhoItensOrfaos
      .filter((e) => normalizarDescricao(e.descricao) === descItemNorm)
      .reduce((s, e) => s + e.quantidade, 0);
    const usado = usadoContrato + usadoEmpenhoSolto + usadoOrfaos;
    const disponivel = Math.max(0, it.quantidade - usado);

    // Valor congelado (snapshot — vide nota em calcularSaldoAta)
    const valorUsadoContrato = it.contratoItens.reduce((s, c) => s + c.valorTotal, 0);
    const valorUsadoEmpenhoSolto = it.empenhoItens
      .filter((e) => e.empenho.contratoId === null)
      .reduce((s, e) => s + e.valorTotal, 0);
    const valorUsadoOrfaos = empenhoItensOrfaos
      .filter((e) => normalizarDescricao(e.descricao) === descItemNorm)
      .reduce((s, e) => s + e.valorTotal, 0);
    const valorUsado = valorUsadoContrato + valorUsadoEmpenhoSolto + valorUsadoOrfaos;

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
      valorUsado,
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
    vigenciaAtual: null,
    vigencias: [],
    acumulado: { valorTotal, valorUsado, valorDisponivel },
  };
}

// Normaliza descrição pra match tolerante (idem versão anterior).
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

// Saldo de um Contrato por vigência. Empenhos de uma vigência abatem só
// dos itens dessa vigência.
export async function calcularSaldoContrato(contratoId: string): Promise<SaldoContrato> {
  const vigencias = await prisma.vigencia.findMany({
    where: { contratoId },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      ordem: true,
      dataInicio: true,
      dataFim: true,
      termoAditivoId: true,
    },
  });

  if (vigencias.length === 0) {
    return calcularSaldoContratoLegacy(contratoId);
  }

  const itensTodos = await prisma.contratoItem.findMany({
    where: { contratoId },
    select: {
      id: true,
      descricao: true,
      unidade: true,
      quantidade: true,
      valorUnitario: true,
      valorTotal: true,
      ataItemId: true,
      vigenciaId: true,
    },
    orderBy: { id: "asc" },
  });

  const empenhoItens = await prisma.empenhoItem.findMany({
    where: { empenho: { contratoId } },
    select: {
      quantidade: true,
      valorTotal: true,
      ataItemId: true,
      descricao: true,
      empenho: { select: { vigenciaId: true } },
    },
  });

  const saldosPorVig: SaldoVigenciaContrato[] = vigencias.map((vig) => {
    const itensDaVig = itensTodos.filter((it) => it.vigenciaId === vig.id);
    const empenhosDaVig = empenhoItens.filter((e) => e.empenho.vigenciaId === vig.id);

    // Alocacao 1-para-1: cada EmpenhoItem consome 1 ContratoItem (nao
    // pode contar em dobro quando ha ContratoItems com mesma descricao).
    // Igor 02/06 reportou contrato 18/2025 com 'Espaço' e 'Buffet' em 2
    // eventos diferentes (mesma descricao, vigenciaId, ata=null) — o
    // empenho de 99.9k aparecia como executado 199.8k. Estrategia:
    //   - Match por ataItemId (preferencial, caso contrato derive de ata).
    //   - Fallback: match por descricao no primeiro ContratoItem com
    //     saldo restante. Capacidade exata: quantidade do ContratoItem.
    const consumoPorItem = new Map<string, { qty: number; valor: number }>();
    for (const ei of empenhosDaVig) {
      const descEi = normalizarDescricao(ei.descricao);
      // 1. Prefere match por ataItemId quando o contrato deriva de ata.
      let alvo = ei.ataItemId
        ? itensDaVig.find((it) => it.ataItemId === ei.ataItemId)
        : undefined;
      // 2. Fallback: primeiro ContratoItem com mesma descricao e saldo
      //    disponivel (qty consumida < qty total).
      if (!alvo) {
        alvo = itensDaVig.find((it) => {
          if (normalizarDescricao(it.descricao) !== descEi) return false;
          const ja = consumoPorItem.get(it.id)?.qty ?? 0;
          return ja < it.quantidade;
        });
      }
      // 3. Ultimo recurso: primeiro ContratoItem com mesma descricao
      //    (mesmo que esteja "estourado") — pra nao perder o registro
      //    do empenho. Aparecera como overflow no proprio item.
      if (!alvo) {
        alvo = itensDaVig.find(
          (it) => normalizarDescricao(it.descricao) === descEi,
        );
      }
      if (!alvo) continue;
      const atual = consumoPorItem.get(alvo.id) ?? { qty: 0, valor: 0 };
      atual.qty += ei.quantidade;
      atual.valor += ei.valorTotal;
      consumoPorItem.set(alvo.id, atual);
    }

    const itensSaldo: SaldoItemContrato[] = itensDaVig.map((it) => {
      const consumo = consumoPorItem.get(it.id) ?? { qty: 0, valor: 0 };
      const usado = consumo.qty;
      // valorUsado: snapshot — soma dos valores congelados nos empenhos.
      // Reajuste retroativo via apostilamento não afeta "Já executado".
      const valorUsado = consumo.valor;
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
        valorUsado,
        valorDisponivel: disponivel * it.valorUnitario,
      };
    });

    const valorTotal = itensSaldo.reduce((s, i) => s + i.valorTotal, 0);
    const valorUsado = itensSaldo.reduce((s, i) => s + i.valorUsado, 0);

    return {
      vigenciaId: vig.id,
      ordem: vig.ordem,
      dataInicio: vig.dataInicio,
      dataFim: vig.dataFim,
      status: classificarStatus(vig.dataInicio, vig.dataFim),
      termoAditivoId: vig.termoAditivoId,
      itens: itensSaldo,
      valorTotal,
      valorUsado,
      valorDisponivel: valorTotal - valorUsado,
      percentualUsado: valorTotal === 0 ? 0 : (valorUsado / valorTotal) * 100,
    };
  });

  const vigenciaAtual = escolherVigenciaAtual(saldosPorVig);
  const acumulado = {
    valorTotal: saldosPorVig.reduce((s, v) => s + v.valorTotal, 0),
    valorUsado: saldosPorVig.reduce((s, v) => s + v.valorUsado, 0),
    valorDisponivel: saldosPorVig.reduce((s, v) => s + v.valorDisponivel, 0),
  };

  return {
    itens: vigenciaAtual?.itens ?? [],
    valorTotal: vigenciaAtual?.valorTotal ?? 0,
    valorUsado: vigenciaAtual?.valorUsado ?? 0,
    valorDisponivel: vigenciaAtual?.valorDisponivel ?? 0,
    percentualUsado: vigenciaAtual?.percentualUsado ?? 0,
    vigenciaAtual,
    vigencias: saldosPorVig,
    acumulado,
  };
}

async function calcularSaldoContratoLegacy(contratoId: string): Promise<SaldoContrato> {
  const itens = await prisma.contratoItem.findMany({
    where: { contratoId },
    orderBy: { id: "asc" },
  });
  const empenhoItens = await prisma.empenhoItem.findMany({
    where: { empenho: { contratoId } },
    select: { quantidade: true, valorTotal: true, ataItemId: true, descricao: true },
  });

  // Alocacao 1-para-1 (mesma logica da versao por vigencia) — cada
  // EmpenhoItem so pode contar pra UM ContratoItem, evitando dupla
  // contagem quando ha duplicatas de descricao no contrato.
  const consumoPorItem = new Map<string, { qty: number; valor: number }>();
  for (const ei of empenhoItens) {
    const descEi = normalizarDescricao(ei.descricao);
    let alvo = ei.ataItemId
      ? itens.find((it) => it.ataItemId === ei.ataItemId)
      : undefined;
    if (!alvo) {
      alvo = itens.find((it) => {
        if (normalizarDescricao(it.descricao) !== descEi) return false;
        const ja = consumoPorItem.get(it.id)?.qty ?? 0;
        return ja < it.quantidade;
      });
    }
    if (!alvo) {
      alvo = itens.find(
        (it) => normalizarDescricao(it.descricao) === descEi,
      );
    }
    if (!alvo) continue;
    const atual = consumoPorItem.get(alvo.id) ?? { qty: 0, valor: 0 };
    atual.qty += ei.quantidade;
    atual.valor += ei.valorTotal;
    consumoPorItem.set(alvo.id, atual);
  }

  const linhas: SaldoItemContrato[] = itens.map((it) => {
    const consumo = consumoPorItem.get(it.id) ?? { qty: 0, valor: 0 };
    const usado = consumo.qty;
    const valorUsado = consumo.valor;
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
      valorUsado,
      valorDisponivel: disponivel * it.valorUnitario,
    };
  });

  const valorTotal = linhas.reduce((s, i) => s + i.valorTotal, 0);
  const valorUsado = linhas.reduce((s, i) => s + i.valorUsado, 0);
  const valorDisponivel = valorTotal - valorUsado;

  return {
    itens: linhas,
    valorTotal,
    valorUsado,
    valorDisponivel,
    percentualUsado: valorTotal === 0 ? 0 : (valorUsado / valorTotal) * 100,
    vigenciaAtual: null,
    vigencias: [],
    acumulado: { valorTotal, valorUsado, valorDisponivel },
  };
}
