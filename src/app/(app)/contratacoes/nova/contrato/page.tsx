import { exigirUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularSaldoAta } from "@/lib/saldo";
import { montarLabelEmpresa } from "@/lib/empresaLabel";
import NovoContratoForm from "./NovoContratoForm";

export default async function Page() {
  const usuario = await exigirUsuario();
  const empresas = await prisma.empresa.findMany({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true, razaoSocial: true, nomeFantasia: true, responsavel: true, cnpj: true },
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

  return (
    <NovoContratoForm
      empresas={empresas.map((e) => ({ value: e.id, label: montarLabelEmpresa(e) }))}
      atas={atasComItens}
    />
  );
}
