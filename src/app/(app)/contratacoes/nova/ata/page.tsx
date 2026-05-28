import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import NovaAtaForm from "./NovaAtaForm";

export default async function Page() {
  const usuario = await exigirUsuario();

  // Resolve quais empresas listar conforme o tipo da conta logada:
  // - EMPRESA: empresas da própria conta (via contaId).
  // - ANALISTA: empresas das contas com VinculoAnalista ATIVO em que o
  //   analista é responsável.
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

  const opcoes = empresas.map((e) => ({
    value: e.id,
    label: montarLabelEmpresa(e),
  }));

  // Quando só há 1 empresa, pré-seleciona (UX: usuário não precisa abrir dropdown
  // pra confirmar a única opção).
  const empresaPreSelecionada = opcoes.length === 1 ? opcoes[0].value : undefined;

  return <NovaAtaForm empresas={opcoes} empresaPreSelecionada={empresaPreSelecionada} />;
}
