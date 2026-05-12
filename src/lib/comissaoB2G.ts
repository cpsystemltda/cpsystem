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

  // Linha B (comissão empresa→analista) — fonte: ComissaoExecucao
  comissaoRecebida: number;          // status PAGO + valorRecebido de PAGO_PARCIAL
  comissaoAReceber: number;          // A_RECEBER + ATRASADO + saldo de PAGO_PARCIAL
  comissaoAguardandoOrgao: number;   // AGUARDANDO_ORGAO (Linha A ainda pendente)
  carteiraContratada: number;        // soma de TODOS os contratos+atas+empenhos vigentes
  totalExecucoes: number;
  totalExecucoesPagasPeloOrgao: number; // Linha A paga
};

export type ResumoComissaoConsolidado = {
  totalComissaoRecebida: number;
  totalComissaoAReceber: number;
  totalComissaoAguardandoOrgao: number;
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

    // Comissões da Linha B (empresa→analista) — fonte canônica é ComissaoExecucao.
    // Cada empenho do vínculo tem 1 linha aqui. Status diferencia:
    //   AGUARDANDO_ORGAO  → órgão ainda não pagou
    //   A_RECEBER/ATRASADO → órgão pagou, comissão pendente de cobrança
    //   PAGO              → analista recebeu integral
    //   PAGO_PARCIAL      → analista recebeu parte
    const comissoes = await prisma.comissaoExecucao.findMany({
      where: { vinculoId: v.id },
      select: {
        status: true,
        valorCalculado: true,
        valorRecebido: true,
        valorBaseEmpenho: true,
      },
    });

    let comissaoRecebida = 0;
    let comissaoAReceber = 0;
    let comissaoAguardandoOrgao = 0;
    let totalExecucoesPagasPeloOrgao = 0;

    for (const c of comissoes) {
      switch (c.status) {
        case "AGUARDANDO_ORGAO":
          // Potencial: usa o valor total empenhado × % (Linha A ainda não ocorreu)
          comissaoAguardandoOrgao +=
            c.valorBaseEmpenho * (v.percentualComissao / 100);
          break;
        case "A_RECEBER":
        case "ATRASADO":
          comissaoAReceber += c.valorCalculado;
          totalExecucoesPagasPeloOrgao++;
          break;
        case "PAGO":
          comissaoRecebida += c.valorRecebido || c.valorCalculado;
          totalExecucoesPagasPeloOrgao++;
          break;
        case "PAGO_PARCIAL":
          comissaoRecebida += c.valorRecebido;
          comissaoAReceber += Math.max(0, c.valorCalculado - c.valorRecebido);
          totalExecucoesPagasPeloOrgao++;
          break;
      }
    }

    const totalExecucoes = comissoes.length;

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
      comissaoAguardandoOrgao,
      carteiraContratada: carteira,
      totalExecucoes,
      totalExecucoesPagasPeloOrgao,
    });
  }

  return {
    totalComissaoRecebida: empresas.reduce((s, e) => s + e.comissaoRecebida, 0),
    totalComissaoAReceber: empresas.reduce((s, e) => s + e.comissaoAReceber, 0),
    totalComissaoAguardandoOrgao: empresas.reduce((s, e) => s + e.comissaoAguardandoOrgao, 0),
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
