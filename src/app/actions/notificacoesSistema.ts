"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";

export async function marcarLidaAction(formData: FormData) {
  const usuario = await exigirUsuario();
  const id = String(formData.get("notificacaoId"));
  await prisma.notificacaoSistema.updateMany({
    where: { id, usuarioId: usuario.id },
    data: { lida: true, lidaEm: new Date() },
  });
  revalidatePath("/notificacoes");
}

export async function marcarTodasLidasAction() {
  const usuario = await exigirUsuario();
  await prisma.notificacaoSistema.updateMany({
    where: { usuarioId: usuario.id, lida: false },
    data: { lida: true, lidaEm: new Date() },
  });
  revalidatePath("/notificacoes");
}

// Job manual: gera PRAZO_PROXIMO pra empenhos com data prevista próxima
export async function gerarAlertasPrazoAction() {
  const usuario = await exigirUsuario();
  if (usuario.perfil !== "ADMIN") throw new Error("Apenas admins.");

  const hoje = new Date();
  const em7d = new Date(hoje.getTime() + 7 * 86400000);

  // Empenhos da própria conta com data prevista de execução ou pagamento ≤ 7d
  const candidatos = await prisma.empenho.findMany({
    where: {
      empresa: { contaId: usuario.contaId },
      status: { not: "PAGO" },
      OR: [
        { dataPrevistaExecucao: { gte: hoje, lte: em7d } },
        { dataPrevistaPagamento: { gte: hoje, lte: em7d } },
      ],
    },
    include: { empresa: { select: { nomeFantasia: true, razaoSocial: true } } },
  });

  const usuariosDaConta = await prisma.usuario.findMany({ where: { contaId: usuario.contaId } });

  let criadas = 0;
  for (const e of candidatos) {
    const dataMaisProxima =
      e.dataPrevistaExecucao && (!e.dataPrevistaPagamento || e.dataPrevistaExecucao < e.dataPrevistaPagamento)
        ? e.dataPrevistaExecucao
        : e.dataPrevistaPagamento;
    if (!dataMaisProxima) continue;
    const dias = Math.ceil((dataMaisProxima.getTime() - hoje.getTime()) / 86400000);

    for (const u of usuariosDaConta) {
      // Evita duplicar (1 por empenho por usuário por dia)
      const ontem = new Date(hoje.getTime() - 86400000);
      const existe = await prisma.notificacaoSistema.findFirst({
        where: {
          usuarioId: u.id,
          tipo: "PRAZO_PROXIMO",
          recursoId: e.id,
          criadoEm: { gte: ontem },
        },
      });
      if (existe) continue;

      await prisma.notificacaoSistema.create({
        data: {
          usuarioId: u.id,
          tipo: "PRAZO_PROXIMO",
          titulo: `Empenho ${e.numero} — prazo em ${dias}d`,
          descricao: `${e.empresa.nomeFantasia || e.empresa.razaoSocial} · ${dataMaisProxima.toLocaleDateString("pt-BR")}`,
          link: `/execucao/${e.id}`,
          recursoTipo: "Empenho",
          recursoId: e.id,
        },
      });
      criadas++;
    }
  }

  revalidatePath("/notificacoes");
  return { criadas };
}
