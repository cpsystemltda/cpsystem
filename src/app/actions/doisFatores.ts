"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarSessao, exigirUsuario, verificarSenha } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import { lerPending2FA, limparPending2FA } from "@/lib/pending2FA";
import {
  registrarTentativa,
  ipDoRequest,
  userAgentDoRequest,
  verificarLimiteLogin,
  mensagemBloqueio,
} from "@/lib/rateLimitLogin";
import { verificarERegistrarDispositivo, notificarLoginDeviceNovo } from "@/lib/dispositivoConhecido";
import {
  gerarSecretBase32,
  otpauthUri,
  verificarCodigoTotp,
  gerarRecoveryCodes,
} from "@/lib/totp";

// 2FA TOTP — Regina 22/07 (SEG P1, feedback-seguranca-zero-gap).
// Fluxo do usuario:
//   1) iniciar2FAAction    — gera secret + QR code; secret ja fica no DB
//                            mas totpAtivadoEm=null (aguardando confirmar)
//   2) confirmar2FAAction  — usuario digita codigo do app -> marca ativo,
//                            gera 8 recovery codes e devolve em CLARO
//                            (unica vez que aparecem)
//   3) regenerarRecoveryCodesAction — invalida os antigos, cria novos
//   4) desativar2FAAction  — pede senha + codigo pra confirmar; zera tudo

type IniciarResult = { ok?: true; erro?: string; secret?: string; qrCodeDataUri?: string; otpauthUri?: string };
type ConfirmarResult = { ok?: true; erro?: string; recoveryCodes?: string[] };
type SimpleResult = { ok?: true; erro?: string; recoveryCodes?: string[] };

// (1) Gera secret + QR code. Se ja existir 2FA ativo, recusa (precisa desativar antes).
export async function iniciar2FAAction(): Promise<IniciarResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const u = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { totpAtivadoEm: true, email: true },
  });
  if (!u) return { erro: "Usuário não encontrado" };
  if (u.totpAtivadoEm) return { erro: "2FA já está ativo. Desative antes de reconfigurar." };

  const secret = gerarSecretBase32();
  const uri = otpauthUri({ secretBase32: secret, contaEmail: u.email });
  const qrCodeDataUri = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, scale: 6 });

  // Grava o secret ja — se o usuario abandonar o fluxo antes de confirmar,
  // proximo iniciar sobrescreve. Nao ha risco: sem totpAtivadoEm, o login
  // nem pede o codigo.
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { totpSecret: secret, totpAtivadoEm: null },
  });

  return { ok: true, secret, qrCodeDataUri, otpauthUri: uri };
}

// (2) Cliente digita codigo do app -> confirmamos, marcamos ativo,
//     geramos e retornamos recovery codes.
export async function confirmar2FAAction(_p: ConfirmarResult | null, formData: FormData): Promise<ConfirmarResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const codigo = String(formData.get("codigo") || "").trim();
  if (!/^\d{6}$/.test(codigo)) return { erro: "Código deve ter 6 dígitos." };

  const u = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { totpSecret: true, totpAtivadoEm: true },
  });
  if (!u?.totpSecret) return { erro: "Nenhuma configuração 2FA em andamento. Inicie de novo." };
  if (u.totpAtivadoEm) return { erro: "2FA já está ativo." };

  if (!verificarCodigoTotp(u.totpSecret, codigo)) {
    return { erro: "Código incorreto. Verifique se o horário do celular está sincronizado e tente de novo." };
  }

  const codes = gerarRecoveryCodes(8);
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { totpAtivadoEm: new Date() },
    }),
    // Limpa recovery codes antigos (fluxo defensivo se sobrar de tentativa anterior)
    prisma.recoveryCode2FA.deleteMany({ where: { usuarioId: usuario.id } }),
    prisma.recoveryCode2FA.createMany({
      data: hashes.map((h) => ({ usuarioId: usuario.id, codigoHash: h })),
    }),
  ]);

  revalidatePath("/conta/seguranca");
  return { ok: true, recoveryCodes: codes };
}

// (3) Regera 8 novos codes. Invalida os antigos.
export async function regenerarRecoveryCodesAction(_p: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  // Exige codigo TOTP atual pra evitar que sessao sequestrada gere novos
  const codigo = String(formData.get("codigo") || "").trim();
  const u = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { totpSecret: true, totpAtivadoEm: true },
  });
  if (!u?.totpAtivadoEm || !u.totpSecret) return { erro: "2FA não está ativo." };
  if (!verificarCodigoTotp(u.totpSecret, codigo)) return { erro: "Código 2FA inválido." };

  const codes = gerarRecoveryCodes(8);
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));

  await prisma.$transaction([
    prisma.recoveryCode2FA.deleteMany({ where: { usuarioId: usuario.id } }),
    prisma.recoveryCode2FA.createMany({
      data: hashes.map((h) => ({ usuarioId: usuario.id, codigoHash: h })),
    }),
  ]);

  revalidatePath("/conta/seguranca");
  return { ok: true, recoveryCodes: codes };
}

// (4) Desativa 2FA. Exige senha atual + codigo TOTP — sem isso, uma sessao
//     sequestrada podia desativar sem que o dono percebesse.
export async function desativar2FAAction(_p: SimpleResult | null, formData: FormData): Promise<SimpleResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const senha = String(formData.get("senha") || "");
  const codigo = String(formData.get("codigo") || "").trim();
  if (!senha) return { erro: "Digite sua senha atual." };
  if (!/^\d{6}$/.test(codigo)) return { erro: "Digite o código 2FA de 6 dígitos." };

  const u = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { senhaHash: true, totpSecret: true, totpAtivadoEm: true },
  });
  if (!u?.totpAtivadoEm || !u.totpSecret) return { erro: "2FA não está ativo." };

  if (!(await verificarSenha(senha, u.senhaHash))) return { erro: "Senha atual incorreta." };
  if (!verificarCodigoTotp(u.totpSecret, codigo)) return { erro: "Código 2FA incorreto." };

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { totpSecret: null, totpAtivadoEm: null },
    }),
    prisma.recoveryCode2FA.deleteMany({ where: { usuarioId: usuario.id } }),
  ]);

  revalidatePath("/conta/seguranca");
  return { ok: true };
}

// (5) Fluxo de login: apos senha correta, se totpAtivadoEm, redirect
// pra /login/2fa. Cliente digita codigo aqui — validamos, criamos sessao
// real, registramos device.
export async function verificar2FALoginAction(_p: { erro?: string } | null, formData: FormData): Promise<{ erro?: string }> {
  const usuarioId = await lerPending2FA();
  if (!usuarioId) {
    return { erro: "Sessão de 2FA expirou. Faça login de novo." };
  }

  const codigo = String(formData.get("codigo") || "").trim().toUpperCase();
  const usarRecovery = String(formData.get("tipo") || "totp") === "recovery";

  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true, email: true, superAdmin: true, telefoneWhatsApp: true,
      totpSecret: true, totpAtivadoEm: true,
      conta: { select: { tipo: true } },
    },
  });
  if (!u?.totpAtivadoEm || !u.totpSecret) {
    // Nao deveria acontecer, mas defensivo
    await limparPending2FA();
    return { erro: "2FA não está mais ativo. Faça login de novo." };
  }

  // SEG: rate limit tambem no 2FA — atacante com senha vazada nao deve poder
  // tentar TOTP infinito. Reusa a mesma tabela TentativaLogin.
  const ip = await ipDoRequest();
  const userAgent = await userAgentDoRequest();
  const limite = await verificarLimiteLogin(u.email, ip);
  if (!limite.permitido) {
    return { erro: mensagemBloqueio(limite.motivo, limite.retryEmSegundos) };
  }

  let valido = false;
  if (usarRecovery) {
    // Codigo de recuperacao — busca todos os disponiveis e compara com bcrypt
    if (!/^[A-Z0-9]{5}-?[A-Z0-9]{5}$/i.test(codigo)) {
      return { erro: "Código de recuperação inválido. Use o formato XXXXX-XXXXX." };
    }
    const norm = codigo.includes("-") ? codigo : `${codigo.slice(0, 5)}-${codigo.slice(5)}`;
    const disponiveis = await prisma.recoveryCode2FA.findMany({
      where: { usuarioId, usadoEm: null },
      select: { id: true, codigoHash: true },
    });
    for (const c of disponiveis) {
      if (await bcrypt.compare(norm, c.codigoHash)) {
        await prisma.recoveryCode2FA.update({
          where: { id: c.id },
          data: { usadoEm: new Date() },
        });
        valido = true;
        break;
      }
    }
  } else {
    if (!/^\d{6}$/.test(codigo)) return { erro: "Código deve ter 6 dígitos." };
    valido = verificarCodigoTotp(u.totpSecret, codigo);
  }

  if (!valido) {
    await registrarTentativa({ email: u.email, ip, sucesso: false, userAgent });
    return { erro: usarRecovery ? "Código de recuperação inválido ou já usado." : "Código 2FA incorreto." };
  }

  // Codigo OK — completar o fluxo de login (o que loginAction faria depois da senha)
  await registrarTentativa({ email: u.email, ip, sucesso: true, userAgent });
  const statusDevice = await verificarERegistrarDispositivo({
    usuarioId: u.id,
    userAgent,
    ip,
  });
  if (statusDevice === "novo") {
    await notificarLoginDeviceNovo({
      usuarioId: u.id,
      telefone: u.telefoneWhatsApp,
      userAgent,
      ip,
      hora: new Date(),
    });
  }

  await criarSessao(u.id);
  await limparPending2FA();

  const destino = u.superAdmin
    ? "/admin-plataforma"
    : u.conta.tipo === "ANALISTA"
      ? "/painel-analista"
      : "/dashboard";
  redirect(destino);
}
