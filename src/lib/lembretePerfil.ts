import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Pede a data de nascimento a quem ainda não informou.
 *
 * Regina 28/08: a regra de ouro manda parabenizar todo mundo no aniversário, e
 * a regra está funcionando — só que sem dado. Dos sete usuários em produção,
 * apenas um tem a data preenchida. A causa é simples: o campo só existia dentro
 * de "Meus dados", e ninguém entra ali por vontade própria.
 *
 * O lembrete vai pelo sino do sistema, uma única vez por pessoa. Aniversário é
 * cortesia — insistir todo dia transformaria carinho em incômodo.
 */
const TITULO = "Quando é seu aniversário?";

export async function lembrarDataNascimento(): Promise<{ criados: number }> {
  const semData = await prisma.usuario.findMany({
    where: { dataNascimento: null },
    select: { id: true, nome: true },
  });
  if (semData.length === 0) return { criados: 0 };

  // Quem já recebeu o convite não recebe de novo, tenha preenchido ou não.
  const jaAvisados = await prisma.notificacaoSistema.findMany({
    where: { usuarioId: { in: semData.map((u) => u.id) }, titulo: TITULO },
    select: { usuarioId: true },
  });
  const avisados = new Set(jaAvisados.map((n) => n.usuarioId));

  let criados = 0;
  for (const u of semData) {
    if (avisados.has(u.id)) continue;
    await prisma.notificacaoSistema.create({
      data: {
        usuarioId: u.id,
        tipo: "AVISO_CP_SYSTEM",
        titulo: TITULO,
        descricao:
          "Queremos te parabenizar no dia certo. Leva dez segundos: informe sua data de " +
          "nascimento em Meus dados.",
        link: "/conta/perfil",
      },
    });
    criados++;
  }
  return { criados };
}
