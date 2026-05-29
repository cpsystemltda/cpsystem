import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import NovaAtaForm, { type AtaValoresIniciais } from "../../../contratacoes/nova/ata/NovaAtaForm";

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function EditarAtaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const ata = await prisma.ata.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      itens: { orderBy: { id: "asc" } },
      orgaos: { orderBy: { tipo: "asc" } },
      enderecosEntrega: { where: { orgaoNaAtaId: null }, orderBy: { id: "asc" } },
      pontosFocais: { where: { orgaoNaAtaId: null }, orderBy: { id: "asc" } },
    },
  });
  if (!ata) notFound();

  if (!podeEditarDocumento(usuario, ata)) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Sem permissão para editar</h1>
        <p className="mt-3 text-sm text-slate-600">{mensagemSemPermissao(ata)}</p>
        <Link
          href={`/atas/${ata.id}`}
          className="mt-6 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Voltar para a Ata
        </Link>
      </div>
    );
  }

  let empresas: { id: string; razaoSocial: string; nomeFantasia: string | null; responsavel: string; cnpj: string }[] = [];
  if (usuario.conta.tipo === "ANALISTA") {
    const analista = await prisma.analista.findUnique({
      where: { contaId: usuario.contaId },
      select: { id: true },
    });
    if (analista) {
      const vinculos = await prisma.vinculoAnalista.findMany({
        where: { analistaId: analista.id, status: "ATIVO" },
        select: { contaId: true },
      });
      const contaIds = vinculos.map((v) => v.contaId);
      if (contaIds.length > 0) {
        empresas = await prisma.empresa.findMany({
          where: { contaId: { in: contaIds } },
          orderBy: { criadoEm: "asc" },
          select: { id: true, razaoSocial: true, nomeFantasia: true, responsavel: true, cnpj: true },
        });
      }
    }
  } else {
    empresas = await prisma.empresa.findMany({
      where: { contaId: usuario.contaId },
      orderBy: { criadoEm: "asc" },
      select: { id: true, razaoSocial: true, nomeFantasia: true, responsavel: true, cnpj: true },
    });
  }

  const opcoes = empresas.map((e) => ({ value: e.id, label: montarLabelEmpresa(e) }));

  const valoresIniciais: AtaValoresIniciais = {
    empresaId: ata.empresaId,
    numero: ata.numero,
    processoAdministrativo: ata.processoAdministrativo,
    tipo: ata.tipo,
    procedimentoSelecao: ata.procedimentoSelecao,
    numeroLicitacao: ata.numeroLicitacao,
    idAtaPncp: ata.idAtaPncp,
    objeto: ata.objeto,
    orgaoNome: ata.orgaoNome,
    orgaoCnpj: ata.orgaoCnpj,
    orgaoEndereco: ata.orgaoEndereco,
    orgaoEmail: ata.orgaoEmail,
    orgaoTelefone: ata.orgaoTelefone,
    dataAssinatura: toDateInput(ata.dataAssinatura) ?? "",
    dataPublicacao: toDateInput(ata.dataPublicacao),
    vigenciaInicio: toDateInput(ata.vigenciaInicio) ?? "",
    vigenciaFim: toDateInput(ata.vigenciaFim) ?? "",
    prazoEntregaDias: ata.prazoEntregaDias,
    prazoEntregaUnidade: ata.prazoEntregaUnidade,
    prazoEntregaNaoAplica: ata.prazoEntregaNaoAplica,
    prazoPagamentoDias: ata.prazoPagamentoDias,
    marcoReajusteOrigem: ata.marcoReajusteOrigem,
    marcoOrcamentoEstimado: toDateInput(ata.marcoOrcamentoEstimado),
    aceitaCarona: ata.aceitaCarona,
    itens: ata.itens.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      marca: i.marca,
      valorUnitario: i.valorUnitario,
      lote: i.lote,
      numero: i.numero,
    })),
    enderecosEntrega: ata.enderecosEntrega.map((e) => ({
      id: e.id,
      rotulo: e.rotulo,
      endereco: e.endereco,
    })),
    pontosFocais: ata.pontosFocais.map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      telefone: p.telefone,
      funcao: p.funcao,
      funcaoDescricao: p.funcaoDescricao,
    })),
    orgaosParticipantes: ata.orgaos
      .filter((o) => o.tipo !== "GERENCIADOR")
      .map((o) => ({
        id: o.id,
        tipo: o.tipo,
        nome: o.nome,
        cnpj: o.cnpj,
        endereco: o.endereco,
        email: o.email,
        telefone: o.telefone,
      })),
  };

  return (
    <NovaAtaForm
      empresas={opcoes}
      modo="editar"
      ataId={ata.id}
      valoresIniciais={valoresIniciais}
    />
  );
}
