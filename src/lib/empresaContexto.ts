"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const COOKIE_EMPRESA = "cp_empresa";

/**
 * Lê o id da empresa selecionada no contexto do usuário (cookie).
 * Retorna null quando o usuário está na visão consolidada (todas as empresas da conta).
 */
export async function lerEmpresaSelecionada(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE_EMPRESA)?.value;
  if (!v || v === "TODAS") return null;
  return v;
}

/**
 * Constrói o `where` para queries de modelos cuja relação é via Empresa
 * (Ata, Contrato, Empenho, Reajuste, etc.).
 *
 * - Quando há empresa selecionada → restringe pela empresa específica.
 * - Quando não há → escopo padrão da conta (todas as empresas do usuário).
 */
export async function filtroEmpresaWhere(contaId: string): Promise<{ contaId: string; id?: string }> {
  const empresaId = await lerEmpresaSelecionada();
  if (!empresaId) return { contaId };
  // Validação: empresa precisa pertencer à conta. Se não pertencer, ignora o filtro
  // (cai pra escopo da conta) — não bloqueia a página.
  const valida = await prisma.empresa.findFirst({
    where: { id: empresaId, contaId },
    select: { id: true },
  });
  return valida ? { contaId, id: valida.id } : { contaId };
}

/**
 * Action de troca de empresa no contexto. Aceita "TODAS" (volta pra consolidado)
 * ou um id de empresa válido. Persiste em cookie, revalida o layout e mantém o
 * usuário na mesma página (via campo `from` enviado pelo client).
 */
export async function selecionarEmpresaAction(formData: FormData) {
  const valor = String(formData.get("empresaId") || "").trim();
  const from = String(formData.get("from") || "").trim();
  const jar = await cookies();
  const cookieValue = !valor || valor === "TODAS" ? "TODAS" : valor;
  jar.set(COOKIE_EMPRESA, cookieValue, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  // Redireciona pra página atual quando recebida; senão cai no dashboard.
  // O redirect só aceita paths internos por segurança.
  const destino = from && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
  redirect(destino);
}
