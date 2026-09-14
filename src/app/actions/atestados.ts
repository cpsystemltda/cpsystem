"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
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

  if (ataId) {
    revalidatePath(`/atas/${ataId}`);
    revalidatePath("/atas");
  }
  if (contratoId) {
    revalidatePath(`/contratos/${contratoId}`);
    revalidatePath("/contratos");
  }
  revalidatePath("/atestados");
  return { ok: true };
}

// ============================================================
// ACOMPANHAMENTO DO PEDIDO AO ÓRGÃO (Regina 11/09)
// ============================================================
//
// Encerrada a vigência, o sistema cobra o atestado. Entre a cobrança e o PDF
// existe um intervalo que não depende do cliente — o órgão precisa emitir — e
// é esse intervalo que estas actions registram. Sem elas o cliente que JÁ
// pediu continuaria recebendo "solicite o atestado" toda semana, e aprenderia
// a ignorar o resumo inteiro junto.

/**
 * Resolve a Ata/Contrato garantindo que pertence à conta de quem chamou.
 *
 * União discriminada por `ok` em vez de checar `"erro" in doc`: com o `in`, o
 * TypeScript não separa os membros direito e o erro chega como
 * `string | undefined` no ponto de uso — que foi exatamente o que o typecheck
 * apontou aqui.
 */
type DocumentoResolvido =
  | { ok: false; erro: string }
  | { ok: true; tipo: "ATA" | "CONTRATO"; id: string; rotulo: string; path: string };

async function documentoDaConta(
  formData: FormData,
  contaId: string,
): Promise<DocumentoResolvido> {
  const ataId = String(formData.get("ataId") || "") || null;
  const contratoId = String(formData.get("contratoId") || "") || null;
  if (!ataId && !contratoId) return { ok: false, erro: "Informe a Ata ou o Contrato." };

  if (ataId) {
    const ata = await prisma.ata.findFirst({
      where: { id: ataId, empresa: { contaId } },
      select: { id: true, numero: true },
    });
    if (!ata) return { ok: false, erro: "Ata não encontrada nesta conta." };
    return {
      ok: true,
      tipo: "ATA",
      id: ata.id,
      rotulo: `Ata ${ata.numero}`,
      path: `/atas/${ata.id}`,
    };
  }

  const c = await prisma.contrato.findFirst({
    where: { id: contratoId as string, empresa: { contaId } },
    select: { id: true, numero: true },
  });
  if (!c) return { ok: false, erro: "Contrato não encontrado nesta conta." };
  return {
    ok: true,
    tipo: "CONTRATO",
    id: c.id,
    rotulo: `Contrato ${c.numero}`,
    path: `/contratos/${c.id}`,
  };
}

type CamposAtestado = {
  atestadoSolicitadoEm?: Date | null;
  atestadoDispensadoEm?: Date | null;
  atestadoDispensaMotivo?: string | null;
};

async function aplicar(
  formData: FormData,
  dados: CamposAtestado,
  resumo: (rotulo: string) => string,
): Promise<ActionResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const doc = await documentoDaConta(formData, usuario.contaId);
  if (!doc.ok) return { ok: false, erro: doc.erro };

  if (doc.tipo === "ATA") {
    await prisma.ata.update({ where: { id: doc.id }, data: dados });
  } else {
    await prisma.contrato.update({ where: { id: doc.id }, data: dados });
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: doc.tipo,
    recursoId: doc.id,
    resumo: resumo(doc.rotulo),
  });

  revalidatePath(doc.path);
  revalidatePath("/atestados");
  revalidatePath(doc.tipo === "ATA" ? "/atas" : "/contratos");
  return { ok: true };
}

/**
 * "Já solicitei ao órgão."
 *
 * Aceita a data do protocolo em vez de assumir hoje: quase sempre o cliente
 * marca isso dias depois de ter pedido, e é a data do pedido que define há
 * quanto tempo o órgão está devendo — o número que ele leva pra cobrar.
 */
export async function marcarAtestadoSolicitadoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const dataStr = String(formData.get("solicitadoEm") || "").trim();
  let solicitadoEm = new Date();
  if (dataStr) {
    const d = new Date(`${dataStr}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return { ok: false, erro: "Data da solicitação inválida." };
    if (d.getTime() > Date.now() + 86400000) {
      return { ok: false, erro: "A data da solicitação não pode estar no futuro." };
    }
    solicitadoEm = d;
  }
  return aplicar(
    formData,
    { atestadoSolicitadoEm: solicitadoEm, atestadoDispensadoEm: null, atestadoDispensaMotivo: null },
    (r) => `Atestado de Capacidade Técnica solicitado ao órgão — ${r}`,
  );
}

/** "Não vou solicitar." Some o alerta; o motivo fica registrado. */
export async function dispensarAtestadoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const motivo = String(formData.get("motivo") || "").trim() || null;
  return aplicar(
    formData,
    { atestadoDispensadoEm: new Date(), atestadoDispensaMotivo: motivo, atestadoSolicitadoEm: null },
    (r) => `Atestado de Capacidade Técnica dispensado — ${r}${motivo ? ` (${motivo})` : ""}`,
  );
}

/** Volta pra fila de cobrança — desfaz tanto a dispensa quanto a solicitação. */
export async function reabrirAtestadoAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return aplicar(
    formData,
    { atestadoDispensadoEm: null, atestadoDispensaMotivo: null, atestadoSolicitadoEm: null },
    (r) => `Atestado de Capacidade Técnica voltou para pendente — ${r}`,
  );
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

  if (atestado.ataId) {
    revalidatePath(`/atas/${atestado.ataId}`);
    revalidatePath("/atas");
  }
  if (atestado.contratoId) {
    revalidatePath(`/contratos/${atestado.contratoId}`);
    revalidatePath("/contratos");
  }
  revalidatePath("/atestados");
  return { ok: true };
}
