"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { exigirUsuario, verificarSenha } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
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
