"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, hashSenha } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarSenhaSegura } from "@/lib/senhaSegura";
import { ehChaveDeModulo, rotuloDoModulo } from "@/lib/modulosAcesso";

type Result = { erro?: string; ok?: boolean };

/**
 * Le a caixa de opcoes do formulario. Quando "acesso completo" vem marcado, o
 * colaborador fica sem restricao nenhuma (igual ao titular). Caso contrario,
 * valem so os modulos marcados — e um colaborador sem nenhum modulo marcado
 * seria um login que nao abre nada, entao isso e barrado como erro.
 */
function lerAcessoDoForm(formData: FormData): { acessoRestrito: boolean; modulos: string[] } | { erro: string } {
  if (String(formData.get("acessoCompleto") || "") === "1") {
    return { acessoRestrito: false, modulos: [] };
  }
  const modulos = formData
    .getAll("modulos")
    .map((m) => String(m))
    .filter(ehChaveDeModulo);
  if (modulos.length === 0) {
    return { erro: "Marque ao menos um módulo — senão essa pessoa entra e não vê nada." };
  }
  return { acessoRestrito: true, modulos };
}

export async function convidarUsuarioAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem convidar usuários." };

  const email = String(formData.get("email") || "").toLowerCase().trim();
  const nome = String(formData.get("nome") || "").trim();
  const perfil = String(formData.get("perfil") || "OPERACIONAL") as "ADMIN" | "OPERACIONAL" | "VISUALIZADOR";
  const senha = String(formData.get("senha") || "");

  if (!nome || nome.length < 2) return { erro: "Nome obrigatório." };
  if (!email.includes("@")) return { erro: "E-mail inválido." };

  // SEG P0: valida senha forte + HIBP.
  const senhaCheck = await validarSenhaSegura(senha, { email, nome });
  if (!senhaCheck.ok) return { erro: senhaCheck.erro };

  if (await prisma.usuario.findUnique({ where: { email } })) return { erro: "E-mail já cadastrado." };

  // Colaborador acima do incluso nao e bloqueado: e cobrado (Regina 21/08).
  // O valor entra na renovacao via `calcularValorMensal`, que conta os usuarios
  // da conta — nada a gravar aqui. A tela avisa o custo ANTES de submeter, pra
  // ninguem descobrir a cobranca na fatura.
  const acesso = lerAcessoDoForm(formData);
  if ("erro" in acesso) return { erro: acesso.erro };

  const senhaHash = await hashSenha(senha);
  const u = await prisma.usuario.create({
    data: {
      nome,
      email,
      senhaHash,
      perfil,
      contaId: usuario.contaId,
      acessoRestrito: acesso.acessoRestrito,
      modulosPermitidos: acesso.modulos,
    },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "Usuario",
    recursoId: u.id,
    resumo: acesso.acessoRestrito
      ? `Convidou ${email} (${perfil}) com acesso a ${acesso.modulos.map(rotuloDoModulo).join(", ")}`
      : `Convidou ${email} (${perfil}) com acesso completo`,
  });

  revalidatePath("/equipe");
  return { ok: true };
}

export async function alterarPerfilAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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

/**
 * Altera a caixa de opcoes de um colaborador que ja existe (Regina 21/08).
 * O titular nao pode ser restringido por ninguem — inclusive por ele mesmo,
 * senao a conta fica sem quem administra os acessos.
 */
export async function atualizarAcessoAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") return { erro: "Apenas admins podem alterar acessos." };

  const usuarioAlvoId = String(formData.get("usuarioId") || "");
  const alvo = await prisma.usuario.findFirst({
    where: { id: usuarioAlvoId, contaId: usuario.contaId },
    select: { id: true, email: true, criadoEm: true },
  });
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (alvo.id === usuario.id) return { erro: "Você não pode limitar o seu próprio acesso." };

  const titular = await prisma.usuario.findFirst({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
    select: { id: true },
  });
  if (titular?.id === alvo.id) return { erro: "O titular da conta sempre tem acesso completo." };

  const acesso = lerAcessoDoForm(formData);
  if ("erro" in acesso) return { erro: acesso.erro };

  await prisma.usuario.update({
    where: { id: alvo.id },
    data: { acessoRestrito: acesso.acessoRestrito, modulosPermitidos: acesso.modulos },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Usuario",
    recursoId: alvo.id,
    resumo: acesso.acessoRestrito
      ? `Acesso de ${alvo.email} → ${acesso.modulos.map(rotuloDoModulo).join(", ")}`
      : `Acesso de ${alvo.email} → completo`,
  });

  revalidatePath("/equipe");
  return { ok: true };
}

export async function removerUsuarioAction(formData: FormData) {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
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
  await bloquearEspionagem();
  // Versao correta pelo tipo da conta (evita import da UI legal na server action).
  const { VERSAO_TERMOS } = await import("@/components/legal/ContratoTermosUso");
  const { VERSAO_CONTRATO_ANALISTA } = await import("@/components/legal/ContratoAnalistaParceiro");
  const versaoAtual = usuario.conta.tipo === "ANALISTA" ? VERSAO_CONTRATO_ANALISTA : VERSAO_TERMOS;
  // Se ja aceitou a versao vigente, no-op. Bump de versao (ex.: v2.1→v2.2)
  // volta o botao pro usuario re-aceitar.
  if (usuario.conta.termosAceitosVersao === versaoAtual) return;
  await prisma.conta.update({
    where: { id: usuario.contaId },
    data: { termosAceitosEm: new Date(), termosAceitosVersao: versaoAtual },
  });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Conta",
    resumo: `Aceitou contrato ${usuario.conta.tipo === "ANALISTA" ? "analista" : "empresa"} versão ${versaoAtual}`,
  });
  revalidatePath("/dashboard");
  revalidatePath("/termos");
  revalidatePath("/conta/completar-cadastro");

  // Regina 14/07: depois do aceite, direciona conforme o tipo/estado da conta:
  //   - EMPRESA TRIAL sem subscription (Leo): completar-cadastro
  //   - ANALISTA: painel do analista
  //   - resto: dashboard
  if (
    usuario.conta.tipo === "EMPRESA" &&
    usuario.conta.statusAssinatura === "TRIAL" &&
    !usuario.conta.gatewaySubscriptionId
  ) {
    redirect("/conta/completar-cadastro");
  }
  if (usuario.conta.tipo === "ANALISTA") {
    redirect("/painel-analista");
  }
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
