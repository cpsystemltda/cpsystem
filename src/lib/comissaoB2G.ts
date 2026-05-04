import { prisma } from "@/lib/prisma";

export type ResumoComissaoEmpresa = {
  contaId: string;
  vinculoId: string;
  empresaPrincipalNome: string;
  cnpjsCount: number;
  percentual: number;
  fixoMensal: number;
  diaVencimentoFixo: number;
  status: "ATIVO" | "ENCERRADO";
  dataInicio: Date;

  // Valores monetários (B2G — execuções de contratos com governo)
  comissaoRecebida: number;          // execuções PAGAS após dataInicio
  comissaoAReceber: number;          // execuções PENDENTES após dataInicio
  carteiraContratada: number;        // soma de TODOS os contratos+atas+empenhos vigentes
  totalExecucoes: number;
  totalExecucoesPagas: number;
};

export type ResumoComissaoConsolidado = {
  totalComissaoRecebida: number;
  totalComissaoAReceber: number;
  totalCarteiraContratada: number;
  totalFixoMensalAtivo: number;
  totalEmpresas: number;
  empresas: ResumoComissaoEmpresa[];
};

// Calcula a comissão B2G de UM analista sobre TODAS as empresas vinculadas
// Regra: só considera execuções (Empenhos) com criadoEm >= vinculo.dataInicio
export async function calcularComissaoAnalista(analistaId: string): Promise<ResumoComissaoConsolidado> {
  const vinculos = await prisma.vinculoAnalista.findMany({
    where: { analistaId },
    include: {
      conta: {
        include: {
          empresas: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        },
      },
    },
    orderBy: { criadoEm: "desc" },
  });

  const empresas: ResumoComissaoEmpresa[] = [];

  for (const v of vinculos) {
    const empresaIds = v.conta.empresas.map((e) => e.id);

    // Comissão sobre execuções (Empenhos) criados após dataInicio
    const empenhos = await prisma.empenho.findMany({
      where: {
        empresaId: { in: empresaIds },
        criadoEm: { gte: v.dataInicio },
      },
      include: { itens: { select: { valorTotal: true } } },
    });

    let comissaoRecebida = 0;
    let comissaoAReceber = 0;
    let totalPagas = 0;

    for (const e of empenhos) {
      const valor = e.itens.reduce((s, i) => s + i.valorTotal, 0);
      const comissao = valor * (v.percentualComissao / 100);
      if (e.status === "PAGO") {
        comissaoRecebida += comissao;
        totalPagas++;
      } else {
        comissaoAReceber += comissao;
      }
    }

    // Carteira contratada: TODOS os contratos+atas vigentes (independente de quando criados)
    const hoje = new Date();
    const [atas, contratos] = await Promise.all([
      prisma.ata.findMany({
        where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hoje } },
        include: { itens: { select: { valorTotal: true } } },
      }),
      prisma.contrato.findMany({
        where: { empresaId: { in: empresaIds }, vigenciaFim: { gte: hoje } },
        include: { itens: { select: { valorTotal: true } } },
      }),
    ]);

    const carteira =
      atas.reduce((s, a) => s + a.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0) +
      contratos.reduce((s, c) => s + c.itens.reduce((ss, i) => ss + i.valorTotal, 0), 0);

    const empresaPrincipal = v.conta.empresas[0];
    empresas.push({
      contaId: v.contaId,
      vinculoId: v.id,
      empresaPrincipalNome: empresaPrincipal?.nomeFantasia || empresaPrincipal?.razaoSocial || "—",
      cnpjsCount: v.conta.empresas.length,
      percentual: v.percentualComissao,
      fixoMensal: v.fixoMensal,
      diaVencimentoFixo: v.diaVencimentoFixo,
      status: v.status as "ATIVO" | "ENCERRADO",
      dataInicio: v.dataInicio,
      comissaoRecebida,
      comissaoAReceber,
      carteiraContratada: carteira,
      totalExecucoes: empenhos.length,
      totalExecucoesPagas: totalPagas,
    });
  }

  return {
    totalComissaoRecebida: empresas.reduce((s, e) => s + e.comissaoRecebida, 0),
    totalComissaoAReceber: empresas.reduce((s, e) => s + e.comissaoAReceber, 0),
    totalCarteiraContratada: empresas.reduce((s, e) => s + e.carteiraContratada, 0),
    totalFixoMensalAtivo: empresas.filter((e) => e.status === "ATIVO").reduce((s, e) => s + e.fixoMensal, 0),
    totalEmpresas: empresas.length,
    empresas,
  };
}

// Lista de empenhos elegíveis pra comissão de UM vínculo (pra detalhe por empresa)
export async function listarExecucoesDoVinculo(vinculoId: string) {
  const v = await prisma.vinculoAnalista.findUnique({
    where: { id: vinculoId },
    include: { conta: { select: { empresas: { select: { id: true } } } } },
  });
  if (!v) return [];

  const empresaIds = v.conta.empresas.map((e) => e.id);
  return prisma.empenho.findMany({
    where: { empresaId: { in: empresaIds }, criadoEm: { gte: v.dataInicio } },
    include: {
      empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true } },
      itens: { select: { valorTotal: true } },
    },
    orderBy: { criadoEm: "desc" },
  });
}
