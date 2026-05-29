import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import NovoContratoForm, {
  type ContratoValoresIniciais,
} from "../../../contratacoes/nova/contrato/NovoContratoForm";

function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  const contrato = await prisma.contrato.findFirst({
    where: { id, empresa: { contaId: usuario.contaId } },
    include: {
      itens: { orderBy: { id: "asc" } },
      parcelas: { orderBy: { numero: "asc" } },
      enderecosEntrega: { orderBy: { id: "asc" } },
      pontosFocais: { orderBy: { id: "asc" } },
    },
  });
  if (!contrato) notFound();

  if (!podeEditarDocumento(usuario, contrato)) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Sem permissão para editar</h1>
        <p className="mt-3 text-sm text-slate-600">{mensagemSemPermissao(contrato)}</p>
        <Link
          href={`/contratos/${contrato.id}`}
          className="mt-6 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Voltar para o Contrato
        </Link>
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
        label: `Ata ${a.numero} — ${a.orgaoNome} (${a.objeto.slice(0, 40)})`,
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

  const valoresIniciais: ContratoValoresIniciais = {
    empresaId: contrato.empresaId,
    ataId: contrato.ataId,
    tipo: contrato.tipo,
    numero: contrato.numero,
    numeroNotaEmpenho: contrato.numeroNotaEmpenho,
    numeroOrdemFornecimento: contrato.numeroOrdemFornecimento,
    processoAdministrativo: contrato.processoAdministrativo,
    procedimentoSelecao: contrato.procedimentoSelecao,
    numeroLicitacao: contrato.numeroLicitacao,
    objeto: contrato.objeto,
    orgaoNome: contrato.orgaoNome,
    orgaoCnpj: contrato.orgaoCnpj,
    orgaoEndereco: contrato.orgaoEndereco,
    orgaoEmail: contrato.orgaoEmail,
    orgaoTelefone: contrato.orgaoTelefone,
    dataAssinatura: toDateInput(contrato.dataAssinatura) ?? "",
    dataPublicacao: toDateInput(contrato.dataPublicacao),
    vigenciaInicio: toDateInput(contrato.vigenciaInicio) ?? "",
    vigenciaFim: toDateInput(contrato.vigenciaFim) ?? "",
    prazoEntregaDias: contrato.prazoEntregaDias,
    prazoEntregaUnidade: contrato.prazoEntregaUnidade,
    // PRAZO_CERTO so existe no Empenho hoje; Contrato cai pra RELATIVO se vier.
    prazoEntregaModo:
      contrato.prazoEntregaModo === "PRAZO_CERTO" ? "RELATIVO" : contrato.prazoEntregaModo,
    dataEntregaCerta: toDateInput(contrato.dataEntregaCerta),
    prazoPagamentoDias: contrato.prazoPagamentoDias,
    marcoReajusteOrigem: contrato.marcoReajusteOrigem,
    marcoOrcamentoEstimado: toDateInput(contrato.marcoOrcamentoEstimado),
    modalidadeEntrega: contrato.modalidadeEntrega,
    marcoInicialPrazo: contrato.marcoInicialPrazo,
    marcoInicialDescricao: contrato.marcoInicialDescricao,
    itens: contrato.itens.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: i.quantidade,
      marca: i.marca,
      valorUnitario: i.valorUnitario,
      lote: i.lote,
      numero: i.numero,
    })),
    parcelas: contrato.parcelas.map((p) => ({
      id: p.id,
      numero: p.numero,
      prazoDias: p.prazoDias,
      descricao: p.descricao,
      valorEstimado: p.valorEstimado,
    })),
    enderecosEntrega: contrato.enderecosEntrega.map((e) => ({
      id: e.id,
      rotulo: e.rotulo,
      endereco: e.endereco,
    })),
    pontosFocais: contrato.pontosFocais.map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      telefone: p.telefone,
      funcao: p.funcao,
      funcaoDescricao: p.funcaoDescricao,
    })),
  };

  return (
    <NovoContratoForm
      empresas={empresas.map((e) => ({ value: e.id, label: montarLabelEmpresa(e) }))}
      atas={atasComItens}
      modo="editar"
      contratoId={contrato.id}
      valoresIniciais={valoresIniciais}
    />
  );
}
