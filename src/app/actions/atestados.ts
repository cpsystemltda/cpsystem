"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import { salvarArquivo } from "@/lib/uploads";

type ActionResult = { ok: true } | { ok: false; erro: string };

// Cria um Atestado de Capacidade Tecnica vinculado a Ata ou Contrato.
// Espera ?ataId=... ou ?contratoId=... no FormData; PDF vem no field "arquivo".
export async function criarAtestadoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const ataId = String(formData.get("ataId") || "") || null;
  const contratoId = String(formData.get("contratoId") || "") || null;
  if (!ataId && !contratoId) return { ok: false, erro: "Informe a Ata ou o Contrato de origem." };

  // Tenancy: confirma que o documento pai pertence à conta.
  if (ataId) {
    const ata = await prisma.ata.findFirst({
      where: { id: ataId, empresa: { contaId: usuario.contaId } },
      select: { id: true },
    });
    if (!ata) return { ok: false, erro: "Ata não encontrada nesta conta." };
  }
  if (contratoId) {
    const c = await prisma.contrato.findFirst({
      where: { id: contratoId, empresa: { contaId: usuario.contaId } },
      select: { id: true },
    });
    if (!c) return { ok: false, erro: "Contrato não encontrado nesta conta." };
  }

  const numero = String(formData.get("numero") || "").trim() || null;
  const dataStr = String(formData.get("dataEmissao") || "").trim();
  if (!dataStr) return { ok: false, erro: "Data de emissão obrigatória." };
  const dataEmissao = new Date(`${dataStr}T12:00:00.000Z`);
  const orgaoEmissor = String(formData.get("orgaoEmissor") || "").trim();
  if (!orgaoEmissor) return { ok: false, erro: "Órgão emissor obrigatório." };
  const objeto = String(formData.get("objeto") || "").trim() || null;
  const observacoes = String(formData.get("observacoes") || "").trim() || null;

  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Anexe o PDF do atestado." };
  let arquivoPdfUrl: string;
  let arquivoPdfNome: string;
  try {
    const salvo = await salvarArquivo(file);
    arquivoPdfUrl = salvo.url;
    arquivoPdfNome = salvo.nome;
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Erro ao salvar PDF.",
    };
  }

  await prisma.atestadoCapacidade.create({
    data: {
      numero,
      dataEmissao,
      orgaoEmissor,
      objeto,
      observacoes,
      arquivoPdfUrl,
      arquivoPdfNome,
      ataId,
      contratoId,
    },
  });

  if (ataId) revalidatePath(`/atas/${ataId}`);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
  return { ok: true };
}

export async function excluirAtestadoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const id = String(formData.get("atestadoId") || "");
  if (!id) return { ok: false, erro: "ID do atestado obrigatório." };

  // Tenancy: garante que o atestado pertence a Ata/Contrato da conta.
  const atestado = await prisma.atestadoCapacidade.findFirst({
    where: {
      id,
      OR: [
        { ata: { empresa: { contaId: usuario.contaId } } },
        { contrato: { empresa: { contaId: usuario.contaId } } },
      ],
    },
    select: { id: true, ataId: true, contratoId: true },
  });
  if (!atestado) return { ok: false, erro: "Atestado não encontrado." };

  await prisma.atestadoCapacidade.delete({ where: { id } });

  if (atestado.ataId) revalidatePath(`/atas/${atestado.ataId}`);
  if (atestado.contratoId) revalidatePath(`/contratos/${atestado.contratoId}`);
  return { ok: true };
}
