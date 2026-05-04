"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, hashSenha } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";

type Result = { erro?: string; ok?: boolean };

export async function convidarUsuarioAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem convidar usuários." };

  const email = String(formData.get("email") || "").toLowerCase().trim();
  const nome = String(formData.get("nome") || "").trim();
  const perfil = String(formData.get("perfil") || "OPERACIONAL") as "ADMIN" | "OPERACIONAL" | "VISUALIZADOR";
  const senha = String(formData.get("senha") || "");

  if (!nome || nome.length < 2) return { erro: "Nome obrigatório." };
  if (!email.includes("@")) return { erro: "E-mail inválido." };
  if (senha.length < 8) return { erro: "Senha deve ter no mínimo 8 caracteres." };

  if (await prisma.usuario.findUnique({ where: { email } })) return { erro: "E-mail já cadastrado." };

  const senhaHash = await hashSenha(senha);
  const u = await prisma.usuario.create({
    data: { nome, email, senhaHash, perfil, contaId: usuario.contaId },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "Usuario",
    recursoId: u.id,
    resumo: `Convidou ${email} (${perfil})`,
  });

  revalidatePath("/equipe");
  return { ok: true };
}

export async function alterarPerfilAction(formData: FormData) {
  const usuario = await exigirUsuario();
  if (usuario.perfil !== "ADMIN") throw new Error("Apenas admins.");

  const usuarioAlvoId = String(formData.get("usuarioId"));
  const novoPerfil = String(formData.get("perfil")) as "ADMIN" | "OPERACIONAL" | "VISUALIZADOR";

  const alvo = await prisma.usuario.findFirst({ where: { id: usuarioAlvoId, contaId: usuario.contaId } });
  if (!alvo) throw new Error("Usuário não encontrado.");
  if (alvo.id === usuario.id) throw new Error("Você não pode alterar seu próprio perfil.");

  await prisma.usuario.update({ where: { id: usuarioAlvoId }, data: { perfil: novoPerfil } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Usuario",
    recursoId: usuarioAlvoId,
    resumo: `Perfil → ${novoPerfil}`,
  });

  revalidatePath("/equipe");
}

export async function removerUsuarioAction(formData: FormData) {
  const usuario = await exigirUsuario();
  if (usuario.perfil !== "ADMIN") throw new Error("Apenas admins.");

  const usuarioAlvoId = String(formData.get("usuarioId"));
  const alvo = await prisma.usuario.findFirst({ where: { id: usuarioAlvoId, contaId: usuario.contaId } });
  if (!alvo) throw new Error("Usuário não encontrado.");
  if (alvo.id === usuario.id) throw new Error("Você não pode remover você mesmo.");

  await prisma.usuario.delete({ where: { id: usuarioAlvoId } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "Usuario",
    recursoId: usuarioAlvoId,
    resumo: `Removeu ${alvo.email}`,
  });

  revalidatePath("/equipe");
}

export async function aceitarTermosAction() {
  const usuario = await exigirUsuario();
  if (usuario.conta.termosAceitosEm) return;
  await prisma.conta.update({ where: { id: usuario.contaId }, data: { termosAceitosEm: new Date() } });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Conta",
    resumo: "Aceitou termos de uso e política de privacidade",
  });
  revalidatePath("/dashboard");
  revalidatePath("/termos");
}

export async function exportarMeusDadosAction() {
  const usuario = await exigirUsuario();
  const dados = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    include: {
      usuarios: { select: { id: true, nome: true, email: true, perfil: true, criadoEm: true } },
      empresas: true,
      analista: true,
    },
  });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXPORTAR",
    recurso: "DadosPessoais",
    resumo: "LGPD — exportou dados",
  });
  return { dados };
}
