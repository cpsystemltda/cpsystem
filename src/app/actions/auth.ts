"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { criarSessao, destruirSessao, hashSenha, verificarSenha } from "@/lib/auth";
import { loginSchema, normalizarCnpj, normalizarCpf, signupAnalistaSchema, signupSchema } from "@/lib/validators";

type ActionResult = {
  erro?: string;
  campos?: Record<string, string>;
  valores?: Record<string, string>;
};

function valoresParaEcho(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k === "senha" || k === "confirmacaoSenha") continue;
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

export async function signupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const dados = Object.fromEntries(formData);
  const parsed = signupSchema.safeParse(dados);
  const valores = valoresParaEcho(formData);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores };
  }

  const v = parsed.data;
  const cnpj = normalizarCnpj(v.cnpj);
  const emailNorm = v.email.trim().toLowerCase();

  // Bloqueio de email duplicado entre empresa e analista (regra de negócio do PO)
  const emailExiste = await prisma.usuario.findUnique({ where: { email: emailNorm } });
  if (emailExiste) {
    return {
      erro: "E-mail já cadastrado em outra conta (empresa ou analista).",
      campos: { email: "E-mail já cadastrado" },
      valores,
    };
  }

  const cnpjExiste = await prisma.empresa.findUnique({ where: { cnpj } });
  if (cnpjExiste) {
    return {
      erro: "CNPJ já cadastrado em outra conta.",
      campos: { cnpj: "CNPJ já cadastrado" },
      valores,
    };
  }

  const senhaHash = await hashSenha(v.senha);
  const trialAteEm = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Vínculo opcional com analista (vem do autocomplete no signup)
  const analistaIdRaw = String(formData.get("analistaId") || "").trim();
  let analistaValido: { id: string; contaId: string | null } | null = null;
  if (analistaIdRaw) {
    const a = await prisma.analista.findUnique({
      where: { id: analistaIdRaw },
      select: { id: true, contaId: true, ativo: true },
    });
    if (!a || !a.ativo) {
      return { erro: "Analista selecionado não está mais disponível." };
    }
    analistaValido = { id: a.id, contaId: a.contaId };
  }

  const conta = await prisma.conta.create({
    data: {
      tipo: "EMPRESA",
      plano: v.plano,
      statusAssinatura: "TRIAL",
      trialAteEm,
      usuarios: {
        create: {
          nome: v.nome,
          email: emailNorm,
          senhaHash,
          perfil: "ADMIN",
        },
      },
      empresas: {
        create: {
          razaoSocial: v.razaoSocial,
          nomeFantasia: v.nomeFantasia || null,
          cnpj,
          porte: v.porte,
          cnaePrincipal: v.cnaePrincipal || null,
          naturezaJuridica: v.naturezaJuridica,
          endereco: v.endereco,
          complemento: v.complemento || null,
          cep: v.cep.replace(/\D/g, ""),
          email: v.emailEmpresa,
          telefones: v.telefones,
          responsavel: v.responsavel,
        },
      },
    },
    include: { usuarios: true },
  });

  // Cria o vínculo + notifica o analista
  if (analistaValido) {
    await prisma.vinculoAnalista.create({
      data: {
        contaId: conta.id,
        analistaId: analistaValido.id,
        dataInicio: new Date(),
        percentualComissao: 0,
        fixoMensal: 0,
        diaVencimentoFixo: 5,
        status: "ATIVO",
      },
    });

    if (analistaValido.contaId) {
      const usuariosDoAnalista = await prisma.usuario.findMany({
        where: { contaId: analistaValido.contaId },
        select: { id: true },
      });
      const { notificar } = await import("@/lib/notificacoes");
      for (const u of usuariosDoAnalista) {
        await notificar({
          usuarioId: u.id,
          tipo: "VINCULO_CRIADO",
          titulo: `Nova empresa vinculou você: ${v.razaoSocial}`,
          descricao: "Defina o percentual de comissão e o fixo mensal no seu painel.",
          link: "/painel-analista",
          recursoTipo: "VinculoAnalista",
          recursoId: conta.id,
        });
      }
    }
  }

  await criarSessao(conta.usuarios[0].id);
  redirect("/dashboard");
}

// Busca pública (sem auth) usada pelo autocomplete no signup.
// Retorna apenas dados não-sensíveis: nome, CPF mascarado e e-mail.
export async function buscarAnalistasPublicos(termo: string) {
  const t = termo.trim();
  if (t.length < 2) return [];

  const cpfDigits = t.replace(/\D/g, "");
  const buscaCpf = cpfDigits.length >= 3;

  // Busca case-insensitive (Igor reportou: "tirar filtro de não encontrar
  // escrevendo minúsculo ou maiúsculo")
  const analistas = await prisma.analista.findMany({
    where: {
      ativo: true,
      OR: [
        { nomeCompleto: { contains: t, mode: "insensitive" } },
        ...(buscaCpf ? [{ cpf: { contains: cpfDigits } }] : []),
      ],
    },
    select: { id: true, nomeCompleto: true, cpf: true, email: true },
    take: 10,
    orderBy: { nomeCompleto: "asc" },
  });

  return analistas.map((a) => ({
    id: a.id,
    nome: a.nomeCompleto,
    cpfMascarado: `***.${a.cpf.slice(3, 6)}.${a.cpf.slice(6, 9)}-**`,
    email: a.email,
  }));
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { erro: "Preencha e-mail e senha." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!usuario) return { erro: "Credenciais inválidas." };

  const ok = await verificarSenha(parsed.data.senha, usuario.senhaHash);
  if (!ok) return { erro: "Credenciais inválidas." };

  await criarSessao(usuario.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destruirSessao();
  redirect("/login");
}

// ============================================================
// SIGNUP DO ANALISTA (conta tipo ANALISTA)
// ============================================================
export async function signupAnalistaAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const dados = Object.fromEntries(formData);
  const valores = valoresParaEcho(formData);
  const parsed = signupAnalistaSchema.safeParse(dados);

  if (!parsed.success) {
    const campos: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0]?.toString();
      if (k && !campos[k]) campos[k] = issue.message;
    }
    return { erro: "Verifique os campos destacados.", campos, valores };
  }

  const v = parsed.data;
  const nome = v.nome.trim();
  const email = v.email.trim().toLowerCase();
  const cpf = normalizarCpf(v.cpf);
  const telefone = v.telefone.trim();
  const endereco = v.endereco.trim();
  const banco = (v.banco ?? "").trim();
  const agencia = (v.agencia ?? "").trim();
  const contaCorrente = (v.contaCorrente ?? "").trim();
  const pix = (v.pix ?? "").trim();
  const razaoSocial = (v.razaoSocial ?? "").trim();
  const nomeFantasia = (v.nomeFantasia ?? "").trim();
  const cnpjPj = v.cnpj ? normalizarCnpj(v.cnpj) : "";
  const portePj = (v.porte ?? "").trim();
  const cnaePrincipal = (v.cnaePrincipal ?? "").trim();
  const cnaesSecundarios = (v.cnaesSecundarios ?? "").trim();
  const naturezaJuridica = (v.naturezaJuridica ?? "").trim();
  const enderecoPj = (v.enderecoPj ?? "").trim();

  const emailExiste = await prisma.usuario.findUnique({ where: { email } });
  if (emailExiste) return { erro: "E-mail já cadastrado.", campos: { email: "E-mail já cadastrado" }, valores };

  const cpfExiste = await prisma.analista.findUnique({ where: { cpf } });
  if (cpfExiste) return { erro: "CPF já cadastrado como analista.", campos: { cpf: "CPF já cadastrado" }, valores };

  const senhaHash = await hashSenha(v.senha);

  const conta = await prisma.conta.create({
    data: {
      tipo: "ANALISTA",
      plano: "BASICO",
      statusAssinatura: "ATIVA", // analista não paga assinatura — só ganha comissão
      usuarios: {
        create: { nome, email, senhaHash, perfil: "ADMIN" },
      },
      analista: {
        create: {
          nomeCompleto: nome,
          cpf,
          telefone,
          endereco,
          cep: v.cep ? v.cep.replace(/\D/g, "") : null,
          complemento: (v.complemento ?? "").trim() || null,
          email,
          banco: banco || null,
          agencia: agencia || null,
          contaCorrente: contaCorrente || null,
          pix: pix || null,
          razaoSocial: razaoSocial || null,
          nomeFantasia: nomeFantasia || null,
          cnpj: cnpjPj.length === 14 ? cnpjPj : null,
          porte: ["MEI", "ME", "EPP", "MEDIA", "GRANDE"].includes(portePj)
            ? (portePj as "MEI" | "ME" | "EPP" | "MEDIA" | "GRANDE")
            : null,
          cnaePrincipal: cnaePrincipal || null,
          cnaesSecundarios: cnaesSecundarios || null,
          naturezaJuridica: naturezaJuridica || null,
          enderecoPj: enderecoPj || null,
          ativo: true,
        },
      },
    },
    include: { usuarios: true },
  });

  await criarSessao(conta.usuarios[0].id);
  redirect("/painel-analista");
}
