"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { getUsuarioAtual } from "@/lib/auth";

const COOKIE_IMPERSONATE = "cp_impersonate";
const COOKIE_EMPRESA = "cp_empresa";
const COOKIE_VISAO = "cp_visao";

// Espionagem expira em 1 hora — é um modo poderoso, melhor pedir re-entrada
// do que deixar o cookie atravessando dias.
const MAX_AGE_S = 60 * 60;

export async function lerContaEspionada(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE_IMPERSONATE)?.value;
  return v && v.length > 0 ? v : null;
}

// Chamado no topo de toda server action que escreve dados. Se o usuário
// estiver em modo espionagem, lança — defesa-em-profundidade mesmo com
// `perfil: VISUALIZADOR` e `superAdmin: false` no objeto trocado.
export async function bloquearEspionagem(): Promise<void> {
  const espionando = await lerContaEspionada();
  if (espionando) {
    throw new Error(
      "Modo espionagem é somente leitura. Saia do modo espionagem para alterar dados.",
    );
  }
}

export async function entrarEspionagemAction(formData: FormData) {
  const usuario = await getUsuarioAtual();
  if (!usuario || !usuario.superAdmin) {
    throw new Error("Apenas gestores da plataforma podem entrar no modo espionagem.");
  }

  const contaId = String(formData.get("contaId") || "").trim();
  if (!contaId) throw new Error("Conta não informada.");

  const alvo = await prisma.conta.findUnique({
    where: { id: contaId },
    include: {
      empresas: { select: { nomeFantasia: true, razaoSocial: true } },
      analista: { select: { nomeCompleto: true } },
    },
  });
  if (!alvo) throw new Error("Conta não encontrada.");

  const jar = await cookies();
  jar.set(COOKIE_IMPERSONATE, alvo.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
  // Reseta empresa em foco — a antiga pertence à conta da Regina/Igor e não
  // existe na conta alvo. Layout cai pra consolidado automaticamente.
  jar.set(COOKIE_EMPRESA, "TODAS", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Alinha a visão com o tipo da conta alvo.
  jar.set(COOKIE_VISAO, alvo.tipo === "ANALISTA" ? "ANALISTA" : "EMPRESA", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Auditoria: usa `LOGIN` + recurso="espionagem" porque o enum AcaoAuditoria
  // não tem ESPIONAGEM (evita migration). Filtro por `recurso` distingue
  // de logins reais.
  await registrarAuditoria({
    contaId: alvo.id,
    usuarioId: usuario.id,
    acao: "LOGIN",
    recurso: "espionagem",
    resumo: `Início da espionagem por ${usuario.nome} (${usuario.email})`,
  });

  revalidatePath("/", "layout");
  redirect(alvo.tipo === "ANALISTA" ? "/painel-analista" : "/dashboard");
}

export async function sairEspionagemAction() {
  const jar = await cookies();
  const contaIdEspionada = jar.get(COOKIE_IMPERSONATE)?.value;

  if (contaIdEspionada) {
    // Pega o usuário REAL (antes do swap) — getUsuarioAtual com cookie ainda
    // setado retornaria o "espião". Vamos direto no DB pelo cookie de sessão.
    const sessaoCookie = jar.get("cp_session")?.value;
    let usuarioRealId: string | null = null;
    if (sessaoCookie) {
      const sessao = await prisma.sessao.findUnique({
        where: { token: sessaoCookie },
        select: { usuarioId: true },
      });
      usuarioRealId = sessao?.usuarioId ?? null;
    }

    await registrarAuditoria({
      contaId: contaIdEspionada,
      usuarioId: usuarioRealId,
      acao: "LOGOUT",
      recurso: "espionagem",
      resumo: "Fim da espionagem",
    });
  }

  jar.delete(COOKIE_IMPERSONATE);
  // Restaura visão de plataforma e zera empresa em foco.
  jar.set(COOKIE_VISAO, "ADMIN_PLATAFORMA", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set(COOKIE_EMPRESA, "TODAS", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  redirect("/admin-plataforma/clientes");
}

// Helper pro layout/banner — lê o cookie e devolve o nome amigável da conta
// espionada. Retorna null fora do modo. Não usa `getUsuarioAtual()` pra não
// criar ciclo (auth → espionagem → auth).
export async function lerEspionagemAtual(): Promise<{ contaId: string; contaNome: string } | null> {
  const contaId = await lerContaEspionada();
  if (!contaId) return null;
  const conta = await prisma.conta.findUnique({
    where: { id: contaId },
    select: {
      empresas: { select: { nomeFantasia: true, razaoSocial: true }, take: 1 },
      analista: { select: { nomeCompleto: true } },
    },
  });
  if (!conta) return null;
  const nome =
    conta.empresas[0]?.nomeFantasia ||
    conta.empresas[0]?.razaoSocial ||
    conta.analista?.nomeCompleto ||
    "Conta";
  return { contaId, contaNome: nome };
}
