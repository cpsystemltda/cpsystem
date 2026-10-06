import { notFound } from "next/navigation";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { instrumentoPorSlug } from "@/lib/instrumentoLabel";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import NovoEmpenhoForm from "../../empenho/NovoEmpenhoForm";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ instrumento: string }>;
  /** `doPortal` = id de um empenho encontrado no Portal da Transparência. */
  searchParams?: Promise<{ doPortal?: string }>;
}) {
  const { instrumento: slug } = await params;
  const sp = (await searchParams) ?? {};
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

  // Equipe da conta, para indicar quem acompanha o fornecimento.
  const colaboradores = (
    await prisma.usuario.findMany({
      where: { contaId: usuario.contaId },
      orderBy: { criadoEm: "asc" },
      select: { id: true, nome: true, email: true },
    })
  ).map((u) => ({ value: u.id, label: `${u.nome} · ${u.email}` }));

  // Pré-preenchimento a partir do Portal da Transparência.
  //
  // O portal publica o empenho do órgão, mas não tudo o que o cadastro pede:
  // não há CNPJ nem endereço do órgão, nem vigência. Por isso **nada é
  // criado automaticamente** — o que o portal sabe entra no formulário já
  // digitado, e a pessoa confere e completa o resto.
  //
  // Criar o registro sozinho seria pior que não importar: empenho com
  // vigência inventada dispara alerta de vencimento falso no dia seguinte.
  const doPortal = sp.doPortal
    ? await prisma.documentoPortal.findFirst({
        where: {
          id: sp.doPortal,
          fase: "EMPENHO",
          empresa: { contaId: usuario.contaId },
        },
        select: {
          codigoResumido: true, codigo: true, data: true, valor: true,
          orgao: true, observacao: true, numeroProcesso: true, itens: true,
          empresaId: true,
        },
      })
    : null;

  // O que o portal publica sobre os itens serve para o OBJETO, não para a
  // tabela de itens.
  //
  // Medido no dado real: o empenho quase nunca tem observação, e a descrição
  // do item é que carrega a contratação — "OBJETO: PAINEL DE LED TIPO OUTDOOR.
  // EVENTO: ENCERRAMENTO DO CURSO DE RADIOPATRULHAMENTO/2026...". Mas
  // quantidade e valor unitário vêm zerados em todos eles. Preencher a tabela
  // com linhas de quantidade 0 e R$ 0 não pouparia digitação: criaria um
  // empenho de valor zero que a pessoa teria de desfazer.
  //
  // Então: descrição vira objeto; item só entra quando traz número de verdade.
  const brutosDoPortal = Array.isArray(doPortal?.itens)
    ? (doPortal.itens as { descricao?: string; quantidade?: number; valorUnitario?: number }[])
        .filter((i) => i && typeof i.descricao === "string" && i.descricao.trim())
    : [];

  const itensDoPortal = brutosDoPortal
    .filter((i) => Number(i.quantidade) > 0 || Number(i.valorUnitario) > 0)
    .map((i) => ({
      descricao: String(i.descricao).trim(),
      unidade: "UN",
      quantidade: Number(i.quantidade) || 0,
      marca: null,
      valorUnitario: Number(i.valorUnitario) || 0,
    }));

  /**
   * O objeto, tirado de onde ele realmente está.
   *
   * Quando a descrição traz "OBJETO:", o que vem depois é a contratação em si
   * — antes disso vêm plano interno, número de ata e validade, que são
   * contabilidade do órgão e não dizem nada a quem vai conferir.
   */
  const descricoes = brutosDoPortal.map((i) => String(i.descricao).trim());
  const comObjeto = descricoes.find((d) => /OBJETO\s*:/i.test(d));
  const objetoDoPortal = (
    doPortal?.observacao?.trim() ||
    (comObjeto
      ? comObjeto.split(/OBJETO\s*:/i)[1]?.trim()
      : descricoes.join("; ")) ||
    ""
  ).slice(0, 500);

  const valoresDoPortal = doPortal
    ? {
        empresaId: doPortal.empresaId,
        ataId: null,
        contratoId: null,
        instrumento,
        tipo: "SERVICO",
        // O número que a pessoa reconhece é o resumido ("2026NE000356"); o
        // código longo carrega unidade gestora e gestão na frente.
        numero: doPortal.codigoResumido || doPortal.codigo,
        numeroOrdemFornecimento: null,
        processoAdministrativo: doPortal.numeroProcesso ?? "",
        procedimentoSelecao: null,
        numeroLicitacao: null,
        objeto: objetoDoPortal,
        orgaoNome: doPortal.orgao ?? "",
        orgaoCnpj: "",
        orgaoEndereco: "",
        orgaoEmail: null,
        orgaoTelefone: null,
        dataEmissao: doPortal.data.toISOString().slice(0, 10),
        vigenciaInicio: doPortal.data.toISOString().slice(0, 10),
        vigenciaFim: "",
        prazoEntregaDias: null,
        prazoPagamentoDias: null,
        itens: itensDoPortal,
        enderecosEntrega: [],
        pontosFocais: [],
      }
    : undefined;

  return (
    <NovoEmpenhoForm
      valoresIniciais={valoresDoPortal}
      colaboradores={colaboradores}
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
