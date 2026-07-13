"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";

// Sistema de cupons (Regina 09/07) — trial estendido + vinculo analista
// automatico. Uso: admin cria cupom pra cliente novo do Igor, cliente aplica
// no signup, ganha trial de 60d (em vez de 14) e ja fica vinculado ao Igor.

type Result = { erro?: string; ok?: boolean; cupom?: unknown };

// Gera codigo random legivel (ex: IGOR-60D-A9F3). Aceita prefix pra
// personalizar (ex: nome do analista) — bom pra tracking.
function gerarCodigoAleatorio(prefixo?: string): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const base = prefixo ? prefixo.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) : "CP";
  return `${base}-${random}`;
}

// Admin cria cupom novo.
export async function criarCupomAction(_p: Result | null, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  // Regina 13/07: só superAdmins (Regina, Igor, Contato CP System) — nunca
  // ADMIN de conta cliente (evita que cliente com perfil ADMIN vire vilão).
  if (!usuario.superAdmin) {
    return { erro: "Apenas super admins da plataforma podem criar cupons." };
  }

  const codigoRaw = String(formData.get("codigo") || "").trim().toUpperCase();
  const descricao = String(formData.get("descricao") || "").trim() || null;
  const diasTrialRaw = Number(formData.get("diasTrial") || 60);
  const analistaVinculadoId = String(formData.get("analistaVinculadoId") || "").trim() || null;
  const validoAteRaw = String(formData.get("validoAte") || "").trim();
  const usosMaximosRaw = String(formData.get("usosMaximos") || "").trim();
  const prefixo = String(formData.get("prefixo") || "").trim();

  const codigo = codigoRaw || gerarCodigoAleatorio(prefixo);
  if (!/^[A-Z0-9-]{3,32}$/.test(codigo)) {
    return { erro: "Código inválido. Use letras, números e - (3 a 32 chars)." };
  }
  const diasTrial = Number.isFinite(diasTrialRaw) && diasTrialRaw >= 1 && diasTrialRaw <= 365
    ? Math.floor(diasTrialRaw) : 60;

  if (analistaVinculadoId) {
    const a = await prisma.analista.count({ where: { id: analistaVinculadoId, ativo: true } });
    if (!a) return { erro: "Analista vinculado não encontrado ou inativo." };
  }

  const validoAte = validoAteRaw ? new Date(validoAteRaw) : null;
  if (validoAte && isNaN(validoAte.getTime())) {
    return { erro: "Data de validade inválida." };
  }
  const usosMaximos = usosMaximosRaw ? Number(usosMaximosRaw) : null;
  if (usosMaximos !== null && (!Number.isFinite(usosMaximos) || usosMaximos < 1)) {
    return { erro: "Usos máximos inválidos (>= 1 ou vazio pra ilimitado)." };
  }

  try {
    const cupom = await prisma.cupom.create({
      data: {
        codigo,
        descricao,
        diasTrial,
        analistaVinculadoId,
        validoAte,
        usosMaximos,
        criadoPorId: usuario.id,
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Cupom",
      recursoId: cupom.id,
      resumo: `Cupom ${cupom.codigo} — ${cupom.diasTrial}d trial${analistaVinculadoId ? " + vínculo analista" : ""}`,
    });

    revalidatePath("/admin/cupons");
    return { ok: true, cupom };
  } catch (err) {
    // codigo unique — mensagem clara
    if (err instanceof Error && err.message.includes("Unique")) {
      return { erro: `Cupom "${codigo}" já existe. Escolha outro código.` };
    }
    return { erro: err instanceof Error ? err.message : "Erro ao criar cupom." };
  }
}

// Editar cupom existente (Regina 13/07). Não permite alterar CÓDIGO (evita
// links antigos quebrarem) nem usosAtuais (auditoria). Ajusta o resto:
// descricao, diasTrial, analistaVinculadoId, validoAte, usosMaximos.
export async function editarCupomAction(
  cupomId: string,
  _p: Result | null,
  formData: FormData,
): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) {
    return { erro: "Apenas super admins da plataforma podem editar cupons." };
  }

  const cupomExistente = await prisma.cupom.findUnique({ where: { id: cupomId }, select: { id: true, codigo: true } });
  if (!cupomExistente) return { erro: "Cupom não encontrado." };

  const descricao = String(formData.get("descricao") || "").trim() || null;
  const diasTrialRaw = Number(formData.get("diasTrial") || 60);
  const analistaVinculadoIdRaw = String(formData.get("analistaVinculadoId") || "").trim();
  const analistaVinculadoId = analistaVinculadoIdRaw || null;
  const validoAteRaw = String(formData.get("validoAte") || "").trim();
  const usosMaximosRaw = String(formData.get("usosMaximos") || "").trim();

  const diasTrial = Number.isFinite(diasTrialRaw) && diasTrialRaw >= 1 && diasTrialRaw <= 365
    ? Math.floor(diasTrialRaw) : 60;

  if (analistaVinculadoId) {
    const a = await prisma.analista.count({ where: { id: analistaVinculadoId, ativo: true } });
    if (!a) return { erro: "Analista vinculado não encontrado ou inativo." };
  }

  const validoAte = validoAteRaw ? new Date(validoAteRaw) : null;
  if (validoAte && isNaN(validoAte.getTime())) {
    return { erro: "Data de validade inválida." };
  }
  const usosMaximos = usosMaximosRaw ? Number(usosMaximosRaw) : null;
  if (usosMaximos !== null && (!Number.isFinite(usosMaximos) || usosMaximos < 1)) {
    return { erro: "Usos máximos inválidos (>= 1 ou vazio pra ilimitado)." };
  }

  try {
    const cupom = await prisma.cupom.update({
      where: { id: cupomId },
      data: { descricao, diasTrial, analistaVinculadoId, validoAte, usosMaximos },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Cupom",
      recursoId: cupom.id,
      resumo: `Editou cupom ${cupom.codigo} — ${cupom.diasTrial}d${analistaVinculadoId ? " + analista" : ""}`,
    });

    revalidatePath("/admin/cupons");
    return { ok: true, cupom };
  } catch (err) {
    return { erro: err instanceof Error ? err.message : "Erro ao editar cupom." };
  }
}

// Toggle ativo (desativa cupom sem apagar histórico).
export async function toggleCupomAtivoAction(cupomId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) {
    return { erro: "Apenas super admins." };
  }
  const c = await prisma.cupom.findUnique({ where: { id: cupomId }, select: { ativo: true } });
  if (!c) return { erro: "Cupom não encontrado." };
  await prisma.cupom.update({ where: { id: cupomId }, data: { ativo: !c.ativo } });
  revalidatePath("/admin/cupons");
  return { ok: true };
}

// Validação PÚBLICA (sem auth) — usada pelo signup pra dar preview do cupom
// antes de submeter. Retorna dados minimos + se aceitou ou nao.
export type ValidacaoCupom =
  | { ok: true; codigo: string; diasTrial: number; analistaNome: string | null; descricao: string | null }
  | { ok: false; motivo: string };

export async function validarCupomPublico(codigo: string): Promise<ValidacaoCupom> {
  const cod = codigo.trim().toUpperCase();
  if (!cod) return { ok: false, motivo: "Código vazio" };
  const c = await prisma.cupom.findUnique({
    where: { codigo: cod },
    include: { analistaVinculado: { select: { nomeCompleto: true, ativo: true } } },
  });
  if (!c) return { ok: false, motivo: "Cupom não encontrado" };
  if (!c.ativo) return { ok: false, motivo: "Cupom desativado" };
  if (c.validoAte && c.validoAte < new Date()) return { ok: false, motivo: "Cupom expirado" };
  if (c.usosMaximos !== null && c.usosAtuais >= c.usosMaximos) {
    return { ok: false, motivo: "Cupom esgotado" };
  }
  return {
    ok: true,
    codigo: c.codigo,
    diasTrial: c.diasTrial,
    analistaNome: c.analistaVinculado?.ativo ? c.analistaVinculado.nomeCompleto : null,
    descricao: c.descricao,
  };
}

// Uso interno pelo signupAction — VALIDA + RESERVA em transacao pra evitar
// race quando 2 usuarios usam ultimo slot simultaneamente. Retorna dados
// pra aplicar na conta OU erro.
export async function aplicarCupomInterno(codigo: string): Promise<{
  ok: true; cupomId: string; diasTrial: number; analistaVinculadoId: string | null;
} | { ok: false; motivo: string }> {
  const cod = codigo.trim().toUpperCase();
  if (!cod) return { ok: false, motivo: "vazio" };
  try {
    // Transacao: incrementa usosAtuais so se ainda tem slot
    const c = await prisma.$transaction(async (tx) => {
      const cupom = await tx.cupom.findUnique({ where: { codigo: cod } });
      if (!cupom) throw new Error("nao_encontrado");
      if (!cupom.ativo) throw new Error("desativado");
      if (cupom.validoAte && cupom.validoAte < new Date()) throw new Error("expirado");
      if (cupom.usosMaximos !== null && cupom.usosAtuais >= cupom.usosMaximos) {
        throw new Error("esgotado");
      }
      await tx.cupom.update({
        where: { id: cupom.id },
        data: { usosAtuais: { increment: 1 } },
      });
      return cupom;
    });
    return {
      ok: true,
      cupomId: c.id,
      diasTrial: c.diasTrial,
      analistaVinculadoId: c.analistaVinculadoId,
    };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "erro";
    return { ok: false, motivo };
  }
}
