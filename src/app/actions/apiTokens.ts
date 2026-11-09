"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { ESCOPOS, gerarToken, type Escopo } from "@/lib/apiPublica";

export type ResultadoToken = { ok?: boolean; erro?: string; token?: string; nome?: string } | null;

/** Cria token de API (só ADMIN). O valor completo volta UMA vez; no banco fica só o hash. */
export async function criarApiTokenAction(_p: ResultadoToken, formData: FormData): Promise<ResultadoToken> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Só o administrador da conta cria tokens de API." };
  const nome = String(formData.get("nome") || "").trim().slice(0, 80);
  if (!nome) return { erro: "Dê um nome ao token (ex.: Sistema Green)." };
  const escopos = formData.getAll("escopos").map(String).filter((e): e is Escopo => (ESCOPOS as readonly string[]).includes(e));
  if (!escopos.includes("leitura")) escopos.unshift("leitura");
  const ativos = await prisma.apiToken.count({ where: { contaId: usuario.contaId, revogadoEm: null } });
  if (ativos >= 5) return { erro: "Limite de 5 tokens ativos. Revogue um antes de criar outro." };
  const { token, prefixo, hash } = gerarToken();
  const t = await prisma.apiToken.create({ data: { contaId: usuario.contaId, nome, prefixo, hash, escopos, criadoPorId: usuario.id }, select: { id: true } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "CRIAR", recurso: "ApiToken", recursoId: t.id, resumo: `Token de API "${nome}" criado (${prefixo}…) · escopos: ${escopos.join(", ")}` });
  revalidatePath("/conta/integracoes");
  return { ok: true, token, nome };
}

export async function revogarApiTokenAction(id: string): Promise<{ ok?: boolean; erro?: string }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Só o administrador da conta revoga tokens." };
  const t = await prisma.apiToken.findFirst({ where: { id, contaId: usuario.contaId, revogadoEm: null }, select: { id: true, nome: true, prefixo: true } });
  if (!t) return { erro: "Token não encontrado." };
  await prisma.apiToken.update({ where: { id }, data: { revogadoEm: new Date() } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "EXCLUIR", recurso: "ApiToken", recursoId: id, resumo: `Token de API "${t.nome}" (${t.prefixo}…) revogado` });
  revalidatePath("/conta/integracoes");
  return { ok: true };
}
