import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Em qual vigência da Ata ou do Contrato este empenho cai.
 *
 * Igor, 05/10/2026, sobre o contrato 82/2024 do Léo: *"na primeira vigência,
 * quantidade contratada 120, executada 140. Na verdade essas execuções que
 * ele está marcando foram feitas na segunda vigência. Bateu a mais aqui, a
 * menos ali, e estou com saldo errado do contrato."*
 *
 * A regra sempre existiu — a vigência sai da data de emissão —, mas vivia
 * dentro da ação de CRIAR. Editar o empenho atualizava `dataEmissao` e
 * deixava `vigenciaId` apontando para onde estava. Resultado: corrigir a data
 * não corrigia o saldo, e não havia como consertar pela tela.
 *
 * Aqui a regra passa a ter um dono só, usado na criação e na edição.
 */
export async function resolverVigenciaDoEmpenho(opts: {
  contratoId?: string | null;
  ataId?: string | null;
  dataEmissao: Date;
}): Promise<string | null> {
  if (!opts.contratoId && !opts.ataId) return null;

  const vigencias = await prisma.vigencia.findMany({
    where: opts.contratoId ? { contratoId: opts.contratoId } : { ataId: opts.ataId! },
    orderBy: { ordem: "asc" },
    select: { id: true, dataInicio: true, dataFim: true },
  });
  if (vigencias.length === 0) return null;

  const dentro = vigencias.find(
    (v) => v.dataInicio <= opts.dataEmissao && v.dataFim >= opts.dataEmissao,
  );
  if (dentro) return dentro.id;

  // Sem encaixe exato, a última. É o caso comum do contrato vencido que ainda
  // recebe empenho atrasado — melhor consumir o saldo da vigência final do
  // que deixar a execução fora de todo controle de saldo.
  return vigencias[vigencias.length - 1].id;
}
