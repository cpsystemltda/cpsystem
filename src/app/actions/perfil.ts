"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, verificarSenha } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";

// Edicao dos proprios dados pessoais (Regina 14/07).
// - EMPRESA: atualiza Usuario (nome/telefoneWhatsApp/cpf/cargo/dataNascimento)
//   + Empresa principal (razao social/CNPJ/endereco/CEP/telefones/email).
// - ANALISTA: atualiza Usuario + Analista (nome, telefone, endereco/CEP,
//   PIX, banco/agencia/CC, dados PJ opcionais).
// - AMBOS: exigem confirmacao da SENHA ATUAL. Sem senha correta, no-op +
//   retorna erro. Log de auditoria detalhado.

export type PerfilResult = {
  erro?: string;
  ok?: boolean;
  detalhe?: string;
  campos?: Partial<Record<string, string>>;
};

export async function atualizarPerfilAction(
  _prev: PerfilResult | null,
  formData: FormData,
): Promise<PerfilResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const senha = String(formData.get("senhaAtual") || "");
  if (!senha) return { erro: "Confirme sua senha atual pra salvar.", campos: { senhaAtual: "Obrigatorio" } };

  // Busca hash da senha e valida
  const usuarioFull = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { senhaHash: true },
  });
  if (!usuarioFull) return { erro: "Usuário não encontrado." };
  const senhaOk = await verificarSenha(senha, usuarioFull.senhaHash);
  if (!senhaOk) return { erro: "Senha atual incorreta.", campos: { senhaAtual: "Senha incorreta" } };

  // ------- Campos comuns do Usuario -------
  const nomeRaw = String(formData.get("nome") || "").trim();
  const telefoneWaRaw = String(formData.get("telefoneWhatsApp") || "").replace(/\D/g, "");
  const cargoRaw = String(formData.get("cargo") || "").trim();
  const cpfRaw = String(formData.get("cpf") || "").replace(/\D/g, "");
  const dataNascRaw = String(formData.get("dataNascimento") || "").trim();

  const dadosUsuario: {
    nome?: string;
    telefoneWhatsApp?: string;
    cargo?: string;
    cpf?: string;
    dataNascimento?: Date;
  } = {};
  if (nomeRaw && nomeRaw !== usuario.nome) {
    if (nomeRaw.length < 2) return { erro: "Nome muito curto.", campos: { nome: "Mínimo 2 caracteres" } };
    dadosUsuario.nome = nomeRaw;
  }
  if (telefoneWaRaw) {
    if (telefoneWaRaw.length < 10) return { erro: "Telefone inválido.", campos: { telefoneWhatsApp: "DDD + numero" } };
    dadosUsuario.telefoneWhatsApp = telefoneWaRaw;
  }
  if (cargoRaw) dadosUsuario.cargo = cargoRaw;
  if (cpfRaw) {
    if (cpfRaw.length !== 11) return { erro: "CPF inválido.", campos: { cpf: "11 dígitos" } };
    dadosUsuario.cpf = cpfRaw;
  }
  if (dataNascRaw) {
    const d = new Date(dataNascRaw);
    if (isNaN(d.getTime())) return { erro: "Data de nascimento inválida.", campos: { dataNascimento: "Formato dd/mm/aaaa" } };
    dadosUsuario.dataNascimento = d;
  }

  if (Object.keys(dadosUsuario).length > 0) {
    await prisma.usuario.update({ where: { id: usuario.id }, data: dadosUsuario });
  }

  // ------- ANALISTA -------
  if (usuario.conta.tipo === "ANALISTA") {
    const analista = await prisma.analista.findUnique({ where: { contaId: usuario.contaId }, select: { id: true } });
    if (!analista) return { erro: "Cadastro de analista não encontrado." };

    const nomeCompletoRaw = String(formData.get("analistaNomeCompleto") || "").trim();
    const telefoneRaw = String(formData.get("analistaTelefone") || "").replace(/\D/g, "");
    const enderecoRaw = String(formData.get("analistaEndereco") || "").trim();
    const cepRaw = String(formData.get("analistaCep") || "").replace(/\D/g, "");
    const complementoRaw = String(formData.get("analistaComplemento") || "").trim();
    const pixRaw = String(formData.get("analistaPix") || "").trim();
    const bancoRaw = String(formData.get("analistaBanco") || "").trim();
    const agenciaRaw = String(formData.get("analistaAgencia") || "").trim();
    const contaCorrenteRaw = String(formData.get("analistaContaCorrente") || "").trim();

    const dadosAnalista: {
      nomeCompleto?: string;
      telefone?: string;
      endereco?: string;
      cep?: string | null;
      complemento?: string | null;
      pix?: string | null;
      banco?: string | null;
      agencia?: string | null;
      contaCorrente?: string | null;
    } = {};
    if (nomeCompletoRaw) dadosAnalista.nomeCompleto = nomeCompletoRaw;
    if (telefoneRaw) {
      if (telefoneRaw.length < 10) return { erro: "Telefone inválido.", campos: { analistaTelefone: "DDD + numero" } };
      dadosAnalista.telefone = telefoneRaw;
    }
    if (enderecoRaw) dadosAnalista.endereco = enderecoRaw;
    if (cepRaw && cepRaw.length === 8) dadosAnalista.cep = cepRaw;
    if (complementoRaw) dadosAnalista.complemento = complementoRaw;
    if (pixRaw) {
      if (pixRaw.length < 4) return { erro: "PIX inválido.", campos: { analistaPix: "Chave muito curta" } };
      dadosAnalista.pix = pixRaw;
    }
    if (bancoRaw) dadosAnalista.banco = bancoRaw;
    if (agenciaRaw) dadosAnalista.agencia = agenciaRaw;
    if (contaCorrenteRaw) dadosAnalista.contaCorrente = contaCorrenteRaw;

    if (Object.keys(dadosAnalista).length > 0) {
      await prisma.analista.update({ where: { id: analista.id }, data: dadosAnalista });
    }
  }

  // ------- EMPRESA -------
  if (usuario.conta.tipo === "EMPRESA") {
    // Atualiza Empresa principal (primeira). Cliente com multi-CNPJ edita
    // demais via /empresas/[id]/editar (outra rota).
    const empresa = await prisma.empresa.findFirst({
      where: { contaId: usuario.contaId },
      orderBy: { criadoEm: "asc" },
      select: { id: true },
    });
    if (empresa) {
      const razaoRaw = String(formData.get("razaoSocial") || "").trim();
      const cnpjRaw = String(formData.get("cnpj") || "").replace(/\D/g, "");
      const enderecoRaw = String(formData.get("endereco") || "").trim();
      const cepRaw = String(formData.get("cep") || "").replace(/\D/g, "");
      const telefonesRaw = String(formData.get("telefones") || "").trim();
      const emailEmpresaRaw = String(formData.get("emailEmpresa") || "").trim();

      const dadosEmpresa: {
        razaoSocial?: string;
        cnpj?: string;
        endereco?: string;
        cep?: string;
        telefones?: string;
        email?: string;
      } = {};
      if (razaoRaw) {
        if (razaoRaw.length < 2) return { erro: "Razão social muito curta.", campos: { razaoSocial: "Mínimo 2 caracteres" } };
        dadosEmpresa.razaoSocial = razaoRaw;
      }
      if (cnpjRaw) {
        if (cnpjRaw.length !== 14) return { erro: "CNPJ inválido.", campos: { cnpj: "14 dígitos" } };
        dadosEmpresa.cnpj = cnpjRaw;
      }
      if (enderecoRaw) {
        if (enderecoRaw.length < 5) return { erro: "Endereço muito curto.", campos: { endereco: "Mínimo 5 caracteres" } };
        dadosEmpresa.endereco = enderecoRaw;
      }
      if (cepRaw && cepRaw.length === 8) dadosEmpresa.cep = cepRaw;
      if (telefonesRaw) dadosEmpresa.telefones = telefonesRaw;
      if (emailEmpresaRaw) {
        if (!emailEmpresaRaw.includes("@")) return { erro: "E-mail inválido.", campos: { emailEmpresa: "E-mail inválido" } };
        dadosEmpresa.email = emailEmpresaRaw;
      }

      if (Object.keys(dadosEmpresa).length > 0) {
        await prisma.empresa.update({ where: { id: empresa.id }, data: dadosEmpresa });
      }
    }
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Perfil",
    resumo: `Editou próprios dados pessoais (${usuario.conta.tipo}) com confirmação de senha`,
  });

  revalidatePath("/conta/perfil");
  return { ok: true, detalhe: "Dados atualizados com sucesso." };
}
