"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { criarSessao, hashSenha } from "@/lib/auth";
import { gerarMagicLink, consumirMagicLink, urlDoMagicLink } from "@/lib/magicLink";
import { enviarTexto } from "@/lib/whatsapp";
import { registrarAuditoria } from "@/lib/auditoria";

// Recuperacao de senha via WhatsApp (Regina 14/07).
// Fluxo:
//   1) /esqueci-senha  -> form com email    -> solicitarResetAction
//      Cria MagicLink motivo=redefinir_senha e envia link por WA.
//   2) /redefinir-senha/[token] -> form com senha nova -> salvarNovaSenhaAction
//      Valida token, hasheia senha, mata sessoes antigas, cria nova sessao.

export type SolicitarResult = {
  erro?: string;
  ok?: boolean;
  detalhe?: string;
  campos?: { email?: string };
};

export async function solicitarResetSenhaAction(
  _prev: SolicitarResult | null,
  formData: FormData,
): Promise<SolicitarResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email.includes("@")) return { erro: "E-mail inválido.", campos: { email: "E-mail inválido" } };

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, telefoneWhatsApp: true, contaId: true },
  });

  // Anti-enumeration: sempre retorna OK, mesmo se email nao existe.
  // Alguem tentando descobrir emails validos nao consegue.
  if (!usuario) {
    return {
      ok: true,
      detalhe:
        "Se este e-mail estiver cadastrado, enviamos as instruções por WhatsApp em instantes. Confira seu WhatsApp.",
    };
  }
  if (!usuario.telefoneWhatsApp) {
    return {
      erro: "Você não tem WhatsApp cadastrado. Fale com o suporte via contato@cpsystem.app.br.",
    };
  }

  try {
    const { token, expiraEm } = await gerarMagicLink({
      usuarioId: usuario.id,
      motivo: "redefinir_senha",
      ttlMs: 30 * 60 * 1000, // 30 minutos — curto pra recuperacao
    });
    const link = `${(process.env.NEXT_PUBLIC_BASE_URL || "https://cpsystem.app.br").replace(/\/$/, "")}/redefinir-senha/${token}`;
    const primeiroNome = usuario.nome.split(" ")[0];
    const validade = expiraEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const msg =
      `Olá ${primeiroNome}, aqui é do CP System.\n\n` +
      `Recebemos um pedido de redefinição de senha. Se foi você, use o link abaixo (válido até ${validade}):\n\n` +
      `${link}\n\n` +
      `Se não foi você, pode ignorar esta mensagem — sua senha atual continua ativa.`;
    await enviarTexto(usuario.telefoneWhatsApp, msg);
    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "MagicLink",
      resumo: "Solicitou reset de senha (envio WA)",
    });
  } catch (err) {
    // Log server-side mas nao expoe erro pro usuario (anti-enumeration).
    console.error("solicitarResetSenhaAction:", err);
  }

  return {
    ok: true,
    detalhe:
      "Se este e-mail estiver cadastrado, enviamos as instruções por WhatsApp em instantes. O link expira em 30 minutos.",
  };
}

export type SalvarNovaSenhaResult = {
  erro?: string;
  campos?: { senha?: string; confirmacaoSenha?: string };
};

export async function salvarNovaSenhaAction(
  _prev: SalvarNovaSenhaResult | null,
  formData: FormData,
): Promise<SalvarNovaSenhaResult> {
  const token = String(formData.get("token") || "");
  const senha = String(formData.get("senha") || "");
  const confirmacao = String(formData.get("confirmacaoSenha") || "");

  if (senha.length < 6) return { erro: "Senha muito curta.", campos: { senha: "Mínimo 6 caracteres" } };
  if (senha !== confirmacao) return { erro: "Confirmação não confere.", campos: { confirmacaoSenha: "Não confere" } };

  const consumido = await consumirMagicLink(token);
  if (!consumido) return { erro: "Link inválido ou expirado. Solicite novo em /esqueci-senha." };
  if (consumido.motivo !== "redefinir_senha") return { erro: "Link inválido para este fluxo." };

  const senhaHash = await hashSenha(senha);
  await prisma.usuario.update({
    where: { id: consumido.usuarioId },
    data: { senhaHash },
  });
  // Mata todas as sessoes antigas — obriga login novo com a senha nova
  await prisma.sessao.deleteMany({ where: { usuarioId: consumido.usuarioId } });
  await criarSessao(consumido.usuarioId);

  const u = await prisma.usuario.findUnique({
    where: { id: consumido.usuarioId },
    select: { contaId: true },
  });
  if (u) {
    await registrarAuditoria({
      contaId: u.contaId,
      usuarioId: consumido.usuarioId,
      acao: "ATUALIZAR",
      recurso: "Usuario",
      resumo: "Redefinição de senha concluída (via magic link WA)",
    });
  }

  redirect("/dashboard");
}
