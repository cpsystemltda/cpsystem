import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import NovoEmpenhoForm, {
  type EmpenhoValoresIniciais,
} from "../../../contratacoes/nova/empenho/NovoEmpenhoForm";

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function EditarEmpenhoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const empenho = await prisma.empenho.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      itens: { orderBy: { id: "asc" } },
      enderecosEntrega: { orderBy: { id: "asc" } },
      pontosFocais: { orderBy: { id: "asc" } },
    },
  });
  if (!empenho) notFound();

  if (!podeEditarDocumento(usuario, empenho)) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Sem permissão para editar</h1>
        <p className="mt-3 text-sm text-slate-600">{mensagemSemPermissao(empenho)}</p>
        <Link
          href={`/execucao/${empenho.id}`}
          className="mt-6 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Voltar para o Empenho
        </Link>
      </div>
    );
  }

  if (empenho.status === "PAGO") {
    // Empenho pago é imutável (regra de negócio)
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Empenho já pago</h1>
        <p className="mt-3 text-sm text-slate-600">
          Empenhos no status PAGO não podem mais ser editados. Para registrar uma correção,
          abra uma notificação administrativa ou consulte o histórico.
        </p>
        <a
          href={`/execucao/${empenho.id}`}
          className="mt-6 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Voltar para o empenho
        </a>
      </div>
    );
  }

  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, razaoSocial: true, nomeFantasia: true, responsavel: true, cnpj: true },
  });

  const atas = await prisma.ata.findMany({
    where: { empresa: { contaId: usuario.contaId } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, numero: true, objeto: true, orgaoNome: true },
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
      };
    }),
  );

  const contratos = await prisma.contrato.findMany({
    where: { empresa: { contaId: usuario.contaId } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, numero: true, objeto: true, orgaoNome: true, ataId: true },
  });

  const valoresIniciais: EmpenhoValoresIniciais = {
    empresaId: empenho.empresaId,
    ataId: empenho.ataId,
    contratoId: empenho.contratoId,
    instrumento: empenho.instrumento,
    tipo: empenho.tipo,
    numero: empenho.numero,
    numeroOrdemFornecimento: empenho.numeroOrdemFornecimento,
    processoAdministrativo: empenho.processoAdministrativo,
    procedimentoSelecao: empenho.procedimentoSelecao,
    numeroLicitacao: empenho.numeroLicitacao,
    objeto: empenho.objeto,
    orgaoNome: empenho.orgaoNome,
    orgaoCnpj: empenho.orgaoCnpj,
    orgaoEndereco: empenho.orgaoEndereco,
    orgaoEmail: empenho.orgaoEmail,
    orgaoTelefone: empenho.orgaoTelefone,
    dataEmissao: toDateInput(empenho.dataEmissao) ?? "",
    vigenciaInicio: toDateInput(empenho.vigenciaInicio) ?? "",
    vigenciaFim: toDateInput(empenho.vigenciaFim) ?? "",
    prazoEntregaDias: empenho.prazoEntregaDias,
    prazoEntregaUnidade: empenho.prazoEntregaUnidade,
    prazoEntregaModo: empenho.prazoEntregaModo === "SOB_DEMANDA" ? "RELATIVO" : empenho.prazoEntregaModo,
    dataEntregaCerta: toDateInput(empenho.dataEntregaCerta),
    prazoPagamentoDias: empenho.prazoPagamentoDias,
    classificacaoOrcamentaria: empenho.classificacaoOrcamentaria,
    signatario: empenho.signatario,
    dataAssinatura: toDateInput(empenho.dataAssinatura),
    departamentoEmissor: empenho.departamentoEmissor,
    pontoColeta: empenho.pontoColeta,
    contatoRecebedor: empenho.contatoRecebedor,
    fiscalResponsavel: empenho.fiscalResponsavel,
    itens: empenho.itens.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      marca: i.marca,
      valorUnitario: i.valorUnitario,
    })),
    enderecosEntrega: empenho.enderecosEntrega.map((e) => ({
      id: e.id,
      rotulo: e.rotulo,
      endereco: e.endereco,
    })),
    pontosFocais: empenho.pontosFocais.map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      telefone: p.telefone,
      funcao: p.funcao,
      funcaoDescricao: p.funcaoDescricao,
    })),
  };

  return (
    <NovoEmpenhoForm
      empresas={empresas.map((e) => ({ value: e.id, label: montarLabelEmpresa(e) }))}
      atas={atasComItens}
      contratos={contratos.map((c) => ({
        value: c.id,
        label: `Contrato ${c.numero} — ${c.orgaoNome}`,
        ataId: c.ataId,
      }))}
      modo="editar"
      empenhoId={empenho.id}
      valoresIniciais={valoresIniciais}
    />
  );
}
