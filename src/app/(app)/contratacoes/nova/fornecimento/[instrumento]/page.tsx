import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { instrumentoPorSlug } from "@/lib/instrumentoLabel";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import NovoEmpenhoForm from "../../empenho/NovoEmpenhoForm";

export default async function Page({
  params,
}: {
  params: Promise<{ instrumento: string }>;
}) {
  const { instrumento: slug } = await params;
  const instrumento = instrumentoPorSlug(slug);
  if (!instrumento) notFound();

  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, razaoSocial: true, nomeFantasia: true, responsavel: true, cnpj: true },
  });

  // Igor (08/06): ao criar fornecimento vinculado a Ata, sistema nao
  // puxava pontos focais nem enderecos cadastrados — usuario reescrevia
  // tudo a cada execucao. Fix: carregar essas relacoes da Ata tambem
  // (espelho do que ja fazia com Contrato).
  const atas = await prisma.ata.findMany({
    where: { empresa: { contaId: usuario.contaId }, vigenciaFim: { gte: new Date() } },
    orderBy: { criadoEm: "desc" },
    include: {
      enderecosEntrega: { select: { id: true, rotulo: true, endereco: true } },
      pontosFocais: {
        select: { id: true, nome: true, email: true, telefone: true, funcao: true, funcaoDescricao: true },
      },
    },
  });

  const atasComItens = await Promise.all(
    atas.map(async (a) => {
      const saldo = await calcularSaldoAta(a.id);
      return {
        value: a.id,
        label: `Ata ${a.numero} — ${a.orgaoNome}`,
        itens: saldo.itens.map((it) => ({
          id: it.ataItemId,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidadeDisponivel: it.quantidadeDisponivel,
          valorUnitario: it.valorUnitario,
        })),
        // Pontos focais e enderecos cadastrados na Ata — sao herdados
        // pelos empenhos derivados (Igor 08/06).
        enderecosEntrega: a.enderecosEntrega,
        pontosFocais: a.pontosFocais,
      };
    }),
  );

  // Carrega contratos com TODOS os campos herdáveis pra pré-preencher o
  // form quando o usuário seleciona "Derivado de Contrato" (M3.3 — Igor:
  // cadastrar várias execuções do mesmo contrato sem redigitar tudo).
  const contratos = await prisma.contrato.findMany({
    where: { empresa: { contaId: usuario.contaId }, vigenciaFim: { gte: new Date() } },
    orderBy: { criadoEm: "desc" },
    include: {
      enderecosEntrega: { select: { id: true, rotulo: true, endereco: true } },
      pontosFocais: {
        select: { id: true, nome: true, email: true, telefone: true, funcao: true, funcaoDescricao: true },
      },
      // Itens do contrato — pra auto-popular a tabela de itens do empenho.
      itens: {
        select: {
          descricao: true,
          unidade: true,
          quantidade: true,
          marca: true,
          valorUnitario: true,
        },
      },
    },
  });

  return (
    <NovoEmpenhoForm
      instrumento={instrumento}
      empresas={empresas.map((e) => ({ value: e.id, label: montarLabelEmpresa(e) }))}
      atas={atasComItens}
      contratos={contratos.map((c) => ({
        value: c.id,
        label: `Contrato ${c.numero} — ${c.orgaoNome}`,
        ataId: c.ataId,
        dados: {
          empresaId: c.empresaId,
          tipo: c.tipo,
          processoAdministrativo: c.processoAdministrativo,
          numeroLicitacao: c.numeroLicitacao,
          objeto: c.objeto,
          orgaoNome: c.orgaoNome,
          orgaoCnpj: c.orgaoCnpj,
          orgaoEndereco: c.orgaoEndereco,
          orgaoEmail: c.orgaoEmail,
          orgaoTelefone: c.orgaoTelefone,
          prazoEntregaDias: c.prazoEntregaDias,
          prazoEntregaUnidade: c.prazoEntregaUnidade,
          // Empenho só suporta RELATIVO | DATA_CERTA — se contrato é SOB_DEMANDA,
          // cai pra RELATIVO em branco (usuário preenche os dias).
          prazoEntregaModo: c.prazoEntregaModo === "SOB_DEMANDA" ? "RELATIVO" : c.prazoEntregaModo,
          dataEntregaCerta: c.dataEntregaCerta ? c.dataEntregaCerta.toISOString().slice(0, 10) : null,
          prazoPagamentoDias: c.prazoPagamentoDias,
          enderecosEntrega: c.enderecosEntrega,
          pontosFocais: c.pontosFocais.map((p) => ({
            id: p.id,
            nome: p.nome,
            email: p.email,
            telefone: p.telefone,
            funcao: p.funcao,
            funcaoDescricao: p.funcaoDescricao,
          })),
          itens: c.itens,
        },
      }))}
    />
  );
}
