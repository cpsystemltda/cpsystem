"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { avisarEquipe } from "@/lib/alertaInterno";

/**
 * Pedido de exclusão de dados — direito do titular (LGPD, art. 18, VI).
 *
 * Regina 28/08, item 6 da fila: não existia caminho nenhum. Um cliente que
 * pedisse o apagamento dependia de alguém fazer no banco, à mão.
 *
 * O pedido NÃO apaga na hora, e isso é decisão consciente, não preguiça:
 *
 * - apagar conta é irreversível e leva junto contrato, empenho e nota fiscal,
 *   que o próprio cliente pode precisar depois;
 * - há retenção legal em jogo — nota fiscal emitida e registro contábil têm
 *   prazo de guarda que a LGPD expressamente preserva (art. 16, I);
 * - assinatura ativa precisa ser encerrada no gateway antes, senão a cobrança
 *   continua correndo para uma conta que não existe mais.
 *
 * Então o pedido vira chamado, avisa a equipe na hora e o prazo de resposta
 * fica escrito na tela. Quem executa é gente, com o botão da última função aqui.
 */
export type ResultadoLgpd = { ok?: true; mensagem?: string; erro?: string };

const TITULO_EXCLUSAO = "LGPD — pedido de exclusão de dados";

export async function solicitarExclusaoContaAction(
  _prev: ResultadoLgpd | null,
  formData: FormData,
): Promise<ResultadoLgpd> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Só quem administra a conta pode pedir a exclusão dos dados." };
  }

  const motivo = String(formData.get("motivo") || "").trim();
  const confirmacao = String(formData.get("confirmacao") || "").trim().toUpperCase();
  if (confirmacao !== "EXCLUIR") {
    return { erro: 'Para confirmar, escreva EXCLUIR no campo indicado.' };
  }

  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    select: {
      id: true,
      statusAssinatura: true,
      empresas: { select: { razaoSocial: true }, take: 1 },
    },
  });
  if (!conta) return { erro: "Conta não encontrada." };

  const jaPediu = await prisma.chamadoSuporte.findFirst({
    where: {
      contaId: conta.id,
      titulo: TITULO_EXCLUSAO,
      status: { notIn: ["RESOLVIDO_ADMIN", "RECUSADO"] },
    },
    select: { id: true },
  });
  if (jaPediu) {
    return {
      ok: true,
      mensagem:
        "Seu pedido já está registrado e em andamento. Retornamos em até 15 dias, como manda a lei.",
    };
  }

  const chamado = await prisma.chamadoSuporte.create({
    data: {
      contaId: conta.id,
      usuarioId: usuario.id,
      categoria: "OUTRO",
      status: "AGUARDANDO_ADMIN",
      titulo: TITULO_EXCLUSAO,
      descricao:
        `Titular: ${usuario.nome} (${usuario.email})\n` +
        `Empresa: ${conta.empresas[0]?.razaoSocial ?? "—"}\n` +
        `Assinatura: ${conta.statusAssinatura}\n\n` +
        `Motivo informado: ${motivo || "(não informado)"}`,
    },
    select: { id: true },
  });

  await registrarAuditoria({
    contaId: conta.id,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Conta",
    recursoId: conta.id,
    resumo: `Pediu exclusão dos dados da conta (LGPD) — chamado ${chamado.id}`,
  });

  await avisarEquipe(
    `🔒 *Pedido de exclusão de dados (LGPD)*\n\n` +
      `Empresa: *${conta.empresas[0]?.razaoSocial ?? "(sem empresa)"}*\n` +
      `Titular: ${usuario.nome} — ${usuario.email}\n` +
      `Assinatura: ${conta.statusAssinatura}\n` +
      (motivo ? `Motivo: ${motivo}\n` : "") +
      `\nO prazo legal de resposta é de 15 dias. Trate em cpsystem.app.br/admin/suporte`,
  ).catch((e) => console.error("[lgpd] aviso à equipe falhou:", e));

  revalidatePath("/conta/privacidade");
  return {
    ok: true,
    mensagem:
      "Pedido registrado. Nossa equipe responde em até 15 dias, como manda a lei — e entra em " +
      "contato antes de apagar qualquer coisa, para você não perder documento de que ainda precise.",
  };
}

/**
 * Executa a exclusão. Só quem administra a plataforma, e só depois de falar
 * com o cliente. Encerra a assinatura no gateway antes de apagar — senão a
 * cobrança segue correndo para uma conta que não existe mais.
 */
export async function executarExclusaoContaAction(
  _prev: ResultadoLgpd | null,
  formData: FormData,
): Promise<ResultadoLgpd> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };

  const contaId = String(formData.get("contaId") || "").trim();
  const confirmacao = String(formData.get("confirmacao") || "").trim();
  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      id: true,
      gatewaySubscriptionId: true,
      empresas: { select: { razaoSocial: true }, take: 1 },
      usuarios: { select: { superAdmin: true } },
    },
  });
  if (!conta) return { erro: "Conta não encontrada." };
  if (conta.usuarios.some((u) => u.superAdmin)) {
    return { erro: "Conta interna do CP System não é excluída por aqui." };
  }
  const nome = conta.empresas[0]?.razaoSocial ?? contaId;
  if (confirmacao !== nome) {
    return { erro: `Para confirmar, escreva exatamente a razão social: ${nome}` };
  }

  if (conta.gatewaySubscriptionId) {
    try {
      const { getGateway } = await import("@/lib/gateway");
      const gateway = await getGateway();
      if (gateway.cancelarAssinatura) await gateway.cancelarAssinatura(conta.gatewaySubscriptionId);
    } catch (e) {
      console.error("[lgpd] falha ao cancelar assinatura antes de excluir:", e);
      return {
        erro: "Não consegui encerrar a assinatura no gateway. Resolva isso antes de apagar a conta.",
      };
    }
  }

  // A auditoria é gravada ANTES: apagar a conta leva junto os registros dela,
  // e o que precisa sobrar é o rastro de quem apagou, quando e a pedido de quem.
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "Conta",
    recursoId: contaId,
    resumo: `Excluiu definitivamente a conta ${nome} a pedido do titular (LGPD)`,
  });

  await prisma.conta.delete({ where: { id: contaId } });

  revalidatePath("/admin-plataforma/clientes");
  return { ok: true, mensagem: `Conta ${nome} excluída definitivamente.` };
}
