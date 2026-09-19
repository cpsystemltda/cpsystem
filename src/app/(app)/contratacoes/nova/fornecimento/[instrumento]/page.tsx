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
  // Igor (11/06): cadastros retroativos exigem listar tambem atas vencidas
  // (caso da ata 66/2024 TST que ele estava alimentando — primeira vigencia
  // ja encerrada, mas precisa lancar empenhos retroativos antes do aditivo).
  // Antes filtravamos so vigentes (vigenciaFim >= hoje). Agora trazemos
  // TUDO, marcando "vencida" no label pra o usuario nao confundir.
  const hoje = new Date();
  const atas = await prisma.ata.findMany({
    where: { empresa: { contaId: usuario.contaId } },
    orderBy: [{ vigenciaFim: "desc" }, { criadoEm: "desc" }],
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
      const vencida = a.vigenciaFim < hoje;
      return {
        value: a.id,
        label: vencida
          ? `Ata ${a.numero} — ${a.orgaoNome} · VENCIDA (${a.vigenciaFim.toLocaleDateString("pt-BR")})`
          : `Ata ${a.numero} — ${a.orgaoNome}`,
        // Itens de TODAS as vigências que ainda têm saldo, e não só os da
        // vigência atual.
        //
        // Igor 15/09/2026, Ata 39 da C.L.A dos Santos: uma execução de
        // 743,75 M² que consome 200 do que sobrou da 1ª vigência e 543,75 da
        // 2ª. Oferecendo só a vigência atual, não havia como lançar isso — e
        // a saída manual (duas execuções) obriga a inventar dois números de
        // empenho para o que o órgão emitiu como um só.
        //
        // Cada linha diz de que vigência veio: são itens de mesma descrição e
        // preços diferentes (o da vigência nova já vem reajustado), então sem
        // o rótulo a escolha viraria sorteio.
        itens: saldo.vigencias
          .flatMap((v) =>
            v.itens.map((it) => ({
              id: it.ataItemId,
              descricao: it.descricao,
              unidade: it.unidade,
              quantidadeDisponivel: it.quantidadeDisponivel,
              valorUnitario: it.valorUnitario,
              vigenciaOrdem: v.ordem,
              vigenciaRotulo:
                `Vigência ${v.ordem} (${v.dataInicio.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ` +
                `${v.dataFim.toLocaleDateString("pt-BR", { timeZone: "UTC" })})`,
            })),
          )
          // Item zerado só polui a lista — quem tem saldo é que pode ser usado.
          .filter((it) => it.quantidadeDisponivel > 0)
          // Vigência corrente primeiro: é de onde sai a maioria das execuções.
          .sort((a, b) => b.vigenciaOrdem - a.vigenciaOrdem),
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
  // Mesma logica das atas (Igor 11/06): tras contratos vencidos tambem,
  // marcando visualmente, pra suportar cadastro retroativo.
  const contratos = await prisma.contrato.findMany({
    where: { empresa: { contaId: usuario.contaId } },
    orderBy: [{ vigenciaFim: "desc" }, { criadoEm: "desc" }],
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
        label: c.vigenciaFim < hoje
          ? `Contrato ${c.numero} — ${c.orgaoNome} · VENCIDO (${c.vigenciaFim.toLocaleDateString("pt-BR")})`
          : `Contrato ${c.numero} — ${c.orgaoNome}`,
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
