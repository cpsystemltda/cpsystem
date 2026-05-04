import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import NovoEmpenhoForm from "./NovoEmpenhoForm";

export default async function Page() {
  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  });

  const atas = await prisma.ata.findMany({
    where: { empresa: { contaId: usuario.contaId }, vigenciaFim: { gte: new Date() } },
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
    where: { empresa: { contaId: usuario.contaId }, vigenciaFim: { gte: new Date() } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, numero: true, objeto: true, orgaoNome: true, ataId: true },
  });

  return (
    <NovoEmpenhoForm
      empresas={empresas.map((e) => ({ value: e.id, label: e.nomeFantasia || e.razaoSocial }))}
      atas={atasComItens}
      contratos={contratos.map((c) => ({
        value: c.id,
        label: `Contrato ${c.numero} — ${c.orgaoNome}`,
        ataId: c.ataId,
      }))}
    />
  );
}
