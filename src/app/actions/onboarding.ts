"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, hashSenha } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { formatarTelefone } from "@/lib/whatsapp";
import { validarSenhaSegura } from "@/lib/senhaSegura";

type Result = { erro?: string; ok?: boolean; campos?: Record<string, string> };

// Onboarding — etapa "Dados pessoais". Salva CPF, cargo, data de
// nascimento, WhatsApp, senha nova. NAO marca onboardingConcluido
// ainda — isso acontece so depois do pagamento (etapa 3).
export async function salvarDadosPessoaisAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const nome = String(formData.get("nome") || "").trim();
  const cpf = String(formData.get("cpf") || "").replace(/\D/g, "");
  const cargo = String(formData.get("cargo") || "").trim();
  const telefoneRaw = String(formData.get("telefone") || "").trim();
  const dataNascimento = String(formData.get("dataNascimento") || "").trim();
  const senha = String(formData.get("senha") || "");
  const confirmacao = String(formData.get("confirmacaoSenha") || "");
  const aceite = String(formData.get("aceiteTermos") || "") === "1";

  const campos: Record<string, string> = {};
  if (nome.length < 2) campos.nome = "Nome muito curto";
  if (cpf.length !== 11) campos.cpf = "CPF deve ter 11 dígitos";
  if (!cargo) campos.cargo = "Informe seu cargo";
  if (!dataNascimento) campos.dataNascimento = "Informe sua data de nascimento";
  if (senha !== confirmacao) campos.confirmacaoSenha = "Senhas não conferem";
  if (!aceite) campos.aceiteTermos = "Você precisa aceitar os termos pra continuar";
  let telefone: string;
  try {
    telefone = formatarTelefone(telefoneRaw);
  } catch {
    campos.telefone = "WhatsApp inválido — inclua DDD";
    telefone = "";
  }
  if (Object.keys(campos).length > 0) return { erro: "Verifique os campos", campos };

  // SEG P0: valida senha forte + HIBP.
  const senhaCheck = await validarSenhaSegura(senha, { email: usuario.email, nome });
  if (!senhaCheck.ok) return { erro: senhaCheck.erro, campos: { senha: senhaCheck.erro } };

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      nome,
      cpf,
      cargo,
      dataNascimento: new Date(dataNascimento + "T00:00:00"),
      telefoneWhatsApp: telefone,
      optInWhatsApp: true,
      senhaHash: await hashSenha(senha),
    },
  });

  // Grava o aceite eletronico na conta (idempotente — só marca se ainda
  // nao foi aceito). MP 2.200-2/2001 art. 10 §2º.
  await prisma.conta.update({
    where: { id: usuario.contaId },
    data: { termosAceitosEm: new Date() },
  });

  revalidatePath("/onboarding");
  redirect("/onboarding/empresa");
}

// Onboarding — etapa 2 "Empresa". Confirma dados da empresa (ou edita).
export async function confirmarEmpresaAction(
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empresa = await prisma.empresa.findFirst({
    where: { contaId: usuario.contaId },
    orderBy: { criadoEm: "asc" },
  });
  if (!empresa) return { erro: "Nenhuma empresa vinculada à conta." };

  const razaoSocial = String(formData.get("razaoSocial") || "").trim();
  const nomeFantasia = String(formData.get("nomeFantasia") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const telefones = String(formData.get("telefones") || "").trim();
  const responsavel = String(formData.get("responsavel") || "").trim();

  await prisma.empresa.update({
    where: { id: empresa.id },
    data: {
      razaoSocial: razaoSocial || empresa.razaoSocial,
      nomeFantasia: nomeFantasia || empresa.nomeFantasia,
      email: email || empresa.email,
      telefones: telefones || empresa.telefones,
      responsavel: responsavel || empresa.responsavel,
    },
  });

  redirect("/onboarding/pagamento");
}

// Onboarding — etapa 3 "Pagamento". Redireciona pro checkout normal.
// Ao voltar do checkout com sucesso, marca onboardingConcluido=true.
export async function concluirOnboardingAction(
  _p: Result | null,
  _formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // So marca concluido se a conta esta paga (ATIVA)
  const conta = await prisma.conta.findUnique({
    where: { id: usuario.contaId },
    select: { statusAssinatura: true },
  });
  if (conta?.statusAssinatura !== "ATIVA") {
    return { erro: "Complete o pagamento antes de acessar o sistema." };
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { onboardingConcluido: true },
  });

  redirect("/dashboard");
}
