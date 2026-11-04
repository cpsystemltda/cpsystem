import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Exclusão de vigência iniciada manualmente.
 *
 * Isabela (Sonne da Amazônia), 04/11/2026, no primeiro dia de uso: iniciou a
 * 2ª vigência do contrato à mão, em seguida cadastrou o 1º Termo Aditivo do
 * mesmo período, e ficou com duas vigências iguais — *"fiz esse segundo
 * lançamento de forma incorreta e não estou sabendo como excluir"*. Não sabia
 * porque não existia: o sistema criava vigência manual e não desfazia.
 * Regina: *"a pessoa tem que ter essa opção."*
 *
 * O que protege, em ordem de quanto dói errar:
 *
 *  1. Vigência de Termo Aditivo não sai por aqui. Ela some com "Excluir
 *     aditivo", que também devolve valor e prazo do documento ao estado
 *     anterior — apagar só a vigência deixaria o aditivo apontando para o nada.
 *  2. A 1ª (original) fica. Ela é o próprio documento; erro nela se corrige
 *     editando o documento.
 *  3. Com execução lançada, não. Empenho sem vigência é histórico perdido.
 *  4. Itens eram cópias feitas na prorrogação e somem com ela — salvo item de
 *     ata que já tenha empenho ou contrato pendurado, porque aí não é cópia,
 *     é referência.
 *  5. As seguintes descem uma posição (3ª vira 2ª). Buraco na numeração
 *     confunde quem olha o histórico e quebra o "ordem N+1" de quem prorroga.
 */

export type ResultadoExclusaoVigencia =
  | { ok: true; ordem: number; renumeradas: number; contratoId: string | null; ataId: string | null }
  | { ok: false; erro: string };

export async function excluirVigenciaManual(opts: {
  vigenciaId: string;
  contaId: string;
}): Promise<ResultadoExclusaoVigencia> {
  const v = await prisma.vigencia.findFirst({
    where: {
      id: opts.vigenciaId,
      OR: [
        { contrato: { empresa: { contaId: opts.contaId } } },
        { ata: { empresa: { contaId: opts.contaId } } },
      ],
    },
    select: {
      id: true,
      ordem: true,
      contratoId: true,
      ataId: true,
      termoAditivoId: true,
      _count: { select: { empenhos: true } },
    },
  });
  if (!v) return { ok: false, erro: "Vigência não encontrada." };

  if (v.termoAditivoId) {
    return {
      ok: false,
      erro:
        "Esta vigência veio de um Termo Aditivo. Para desfazê-la, exclua o aditivo na aba Aditivos — " +
        "o valor e o prazo do documento voltam junto.",
    };
  }

  const escopo = v.contratoId ? { contratoId: v.contratoId } : { ataId: v.ataId ?? "" };
  const total = await prisma.vigencia.count({ where: escopo });
  if (v.ordem === 1 || total <= 1) {
    return {
      ok: false,
      erro: "A vigência original não pode ser excluída. Para corrigir datas ou valor, edite o próprio documento.",
    };
  }

  if (v._count.empenhos > 0) {
    return {
      ok: false,
      erro:
        `Esta vigência tem ${v._count.empenhos} execução(ões) lançada(s). ` +
        `Remova ou realoque essas execuções antes de excluir — senão o histórico de execução ficaria sem vigência.`,
    };
  }

  if (v.ataId) {
    const presos = await prisma.ataItem.count({
      where: {
        vigenciaId: v.id,
        OR: [{ empenhoItens: { some: {} } }, { contratoItens: { some: {} } }],
      },
    });
    if (presos > 0) {
      return {
        ok: false,
        erro: `${presos} item(ns) desta vigência já têm empenho ou contrato vinculado. Remova esses vínculos antes de excluir.`,
      };
    }
  }

  const renumeradas = await prisma.$transaction(async (tx) => {
    await tx.contratoItem.deleteMany({ where: { vigenciaId: v.id } });
    await tx.ataItem.deleteMany({ where: { vigenciaId: v.id } });
    await tx.vigencia.delete({ where: { id: v.id } });

    // Em ordem crescente: a posição que cada uma ocupa acabou de ser
    // liberada pela anterior, então a unicidade (documento, ordem) não reclama.
    const seguintes = await tx.vigencia.findMany({
      where: { ...escopo, ordem: { gt: v.ordem } },
      orderBy: { ordem: "asc" },
      select: { id: true, ordem: true },
    });
    for (const s of seguintes) {
      await tx.vigencia.update({ where: { id: s.id }, data: { ordem: s.ordem - 1 } });
    }
    return seguintes.length;
  });

  return { ok: true, ordem: v.ordem, renumeradas, contratoId: v.contratoId, ataId: v.ataId };
}
