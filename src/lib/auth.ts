import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "cp_session";
const COOKIE_IMPERSONATE = "cp_impersonate";
const SESSION_DAYS = 30;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.sessao.create({
    data: { token, usuarioId, expiraEm },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiraEm,
    path: "/",
  });
}

export async function destruirSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.sessao.deleteMany({ where: { token } });
    jar.delete(SESSION_COOKIE);
  }
  // Garante que espionagem não vaza entre sessões.
  jar.delete(COOKIE_IMPERSONATE);
}

export const getUsuarioAtual = cache(async function getUsuarioAtual() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { token },
    include: {
      usuario: {
        include: {
          conta: { include: { empresas: true } },
        },
      },
    },
  });

  if (!sessao || sessao.expiraEm < new Date()) {
    if (sessao) await prisma.sessao.delete({ where: { id: sessao.id } }).catch(() => {});
    return null;
  }

  const usuarioReal = sessao.usuario;

  // Modo espionagem: super admin "entra como cliente" e vê o sistema em
  // somente leitura. O swap substitui contaId/conta pelo alvo e zera os
  // bypasses de super admin/perfil — escrita é bloqueada nas server actions
  // por `bloquearEspionagem()`.
  if (!usuarioReal.superAdmin) return usuarioReal;
  const contaEspionadaId = jar.get(COOKIE_IMPERSONATE)?.value;
  if (!contaEspionadaId) return usuarioReal;

  const contaAlvo = await prisma.conta.findUnique({
    where: { id: contaEspionadaId },
    include: { empresas: true },
  });
  if (!contaAlvo) return usuarioReal;

  const usuarioEspiao: typeof usuarioReal = {
    ...usuarioReal,
    contaId: contaAlvo.id,
    conta: contaAlvo,
    superAdmin: false,
    perfil: "VISUALIZADOR",
  };
  return usuarioEspiao;
});

export async function exigirUsuario() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  return u;
}
