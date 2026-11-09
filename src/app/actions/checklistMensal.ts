"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { bloqueioModulo } from "@/lib/faixasTerceirizacaoServer";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarArquivo } from "@/lib/uploads";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { pareceDocumentoDeSaude } from "@/lib/lgpd";
import { rotuloCompetencia } from "@/lib/competencias";
import { ROTULO_STATUS_ITEM, STATUS_ITEM, type StatusItemChecklist } from "@/lib/checklistMensal";
import { criarItensDaCompetencia, sincronizarEtapaDoc, type AnexoItem } from "@/lib/checklistMensalServer";

type Result = { ok?: boolean; erro?: string; mensagem?: string } | null;

function parseDia(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function anexosDe(json: unknown): AnexoItem[] {
  return Array.isArray(json) ? (json as AnexoItem[]) : [];
}

async function itemDaConta(itemId: string, contaId: string) {
  return prisma.checklistItemCompetencia.findFirst({
    where: { id: itemId, competencia: { contrato: { empresa: { contaId } } } },
    include: { competencia: { select: { id: true, competencia: true, contratoId: true, contrato: { select: { criadoPorId: true } } } } },
  });
}

/** RN03: status, anexos, validade, data de envio, devolução. */
export async function atualizarItemChecklistAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const item = await itemDaConta(String(formData.get("itemId") || ""), usuario.contaId);
  if (!item) return { erro: "Item não encontrado." };
  if (!podeEditarDocumento(usuario, item.competencia.contrato)) return { erro: mensagemSemPermissao(item.competencia.contrato) };

  const anexos = anexosDe(item.anexos);
  for (const f of formData.getAll("arquivos")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (pareceDocumentoDeSaude(f.name)) return { erro: `"${f.name}" parece documento médico. Não envie atestados, ASO ou laudos (LGPD).` };
    try {
      const salvo = await salvarArquivo(f);
      anexos.push({ nome: salvo.nome, url: salvo.url, enviadoEm: new Date().toISOString() });
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Falha ao salvar o anexo." };
    }
  }
  let status = String(formData.get("status") || item.status) as StatusItemChecklist;
  if (!STATUS_ITEM.includes(status)) status = item.status;
  if (status === "PENDENTE" && anexos.length > 0 && formData.get("status") == null) status = "ANEXADO";
  const motivo = String(formData.get("motivoDevolucao") || "").trim();
  if (status === "DEVOLVIDO" && !motivo && !item.motivoDevolucao) return { erro: "Registre o motivo da devolução informado pelo órgão." };
  if ((status === "ENVIADO" || status === "ACEITO") && anexos.length === 0) return { erro: "Anexe o documento antes de marcar como enviado." };
  const validade = parseDia(String(formData.get("validade") || ""));
  const dataEnvio = parseDia(String(formData.get("dataEnvio") || ""));
  const observacao = String(formData.get("observacao") || "").trim() || null;

  await prisma.checklistItemCompetencia.update({
    where: { id: item.id },
    data: {
      status,
      anexos: anexos.length ? anexos : undefined,
      validade: item.temValidade ? validade ?? item.validade : item.validade,
      dataEnvio: status === "ENVIADO" || status === "ACEITO" ? dataEnvio ?? item.dataEnvio ?? new Date() : item.dataEnvio,
      dataAceite: status === "ACEITO" ? new Date() : status === "DEVOLVIDO" ? null : item.dataAceite,
      motivoDevolucao: status === "DEVOLVIDO" ? motivo || item.motivoDevolucao : null,
      observacao,
      reaproveitadoDeId: anexos.length !== anexosDe(item.anexos).length ? null : item.reaproveitadoDeId,
      atualizadoPorId: usuario.id,
    },
  });
  const sync = await sincronizarEtapaDoc(item.competenciaId, usuario.id);
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: item.competenciaId, resumo: `${rotuloCompetencia(item.competencia.competencia)}: checklist "${item.nome}" → ${ROTULO_STATUS_ITEM[status]}${anexos.length !== anexosDe(item.anexos).length ? ` (${anexos.length} anexo(s))` : ""}${status === "DEVOLVIDO" && motivo ? ` · motivo: ${motivo}` : ""}` });
  revalidatePath(`/competencias/${item.competenciaId}`);
  revalidatePath(`/contratos/${item.competencia.contratoId}`);
  return { ok: true, mensagem: sync === "MARCADA" ? "Item atualizado. Todos os obrigatórios enviados: etapa “Documentação trabalhista enviada” marcada." : sync === "DESMARCADA" ? "Item devolvido registrado: a etapa de documentação voltou a pendente." : "Item atualizado." };
}

export async function removerAnexoItemAction(itemId: string, url: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const item = await itemDaConta(itemId, usuario.contaId);
  if (!item) return { erro: "Item não encontrado." };
  if (!podeEditarDocumento(usuario, item.competencia.contrato)) return { erro: mensagemSemPermissao(item.competencia.contrato) };
  const anexos = anexosDe(item.anexos).filter((a) => a.url !== url);
  const status: StatusItemChecklist = anexos.length === 0 && (item.status === "ANEXADO" || item.status === "ENVIADO") ? "PENDENTE" : item.status;
  await prisma.checklistItemCompetencia.update({ where: { id: itemId }, data: { anexos: anexos.length ? anexos : [], status, reaproveitadoDeId: null, atualizadoPorId: usuario.id } });
  await sincronizarEtapaDoc(item.competenciaId, usuario.id);
  revalidatePath(`/competencias/${item.competenciaId}`);
  return { ok: true, mensagem: "Anexo removido." };
}

/** Reaproveita certidão válida já anexada em outra competência/contrato da conta. */
export async function reaproveitarCertidaoAction(itemId: string, origemId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const item = await itemDaConta(itemId, usuario.contaId);
  if (!item) return { erro: "Item não encontrado." };
  if (!podeEditarDocumento(usuario, item.competencia.contrato)) return { erro: mensagemSemPermissao(item.competencia.contrato) };
  const origem = await itemDaConta(origemId, usuario.contaId);
  if (!origem || origem.codigo !== item.codigo || !origem.validade) return { erro: "Certidão de origem não encontrada." };
  await prisma.checklistItemCompetencia.update({
    where: { id: itemId },
    data: { anexos: anexosDe(origem.anexos), validade: origem.validade, status: item.status === "PENDENTE" ? "ANEXADO" : item.status, reaproveitadoDeId: origem.id, atualizadoPorId: usuario.id },
  });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: item.competenciaId, resumo: `${rotuloCompetencia(item.competencia.competencia)}: "${item.nome}" reaproveitada de ${rotuloCompetencia(origem.competencia.competencia)} (válida até ${origem.validade.toLocaleDateString("pt-BR", { timeZone: "UTC" })})` });
  revalidatePath(`/competencias/${item.competenciaId}`);
  return { ok: true, mensagem: "Certidão reaproveitada." };
}

export async function montarChecklistAction(competenciaId: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const c = await prisma.competencia.findFirst({ where: { id: competenciaId, contrato: { empresa: { contaId: usuario.contaId } } }, select: { id: true, contratoId: true, contrato: { select: { criadoPorId: true } } } });
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  const n = await criarItensDaCompetencia(competenciaId);
  revalidatePath(`/competencias/${competenciaId}`);
  return { ok: true, mensagem: n ? `${n} item(ns) adicionados do modelo do contrato.` : "O checklist já tem todos os itens do modelo." };
}

// ─────────────────────────────────────────────
// Modelo do contrato (RN02)
// ─────────────────────────────────────────────

async function contratoDaConta(contratoId: string, contaId: string) {
  return prisma.contrato.findFirst({ where: { id: contratoId, empresa: { contaId } }, select: { id: true, criadoPorId: true, regimeLegal: true } });
}

export async function salvarItemModeloAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "");
  const contrato = await contratoDaConta(contratoId, usuario.contaId);
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  const id = String(formData.get("id") || "").trim() || null;
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { erro: "Informe o nome do item." };
  const obrigatorio = formData.get("obrigatorio") === "1";
  const temValidade = formData.get("temValidade") === "1";
  // Checkbox desmarcado não viaja no FormData; o hidden "ativoHidden" espelha o estado.
  const ativoHidden = formData.get("ativoHidden");
  // Obrigatório implica ativo: ninguém marca "o órgão exige" para o item ficar fora.
  const ativo = obrigatorio || (ativoHidden == null ? formData.get("ativo") === "1" : ativoHidden === "1");
  const prazoRaw = Number(formData.get("prazoDiaMesSeguinte") || 0);
  const prazoDiaMesSeguinte = prazoRaw >= 1 && prazoRaw <= 31 ? Math.round(prazoRaw) : null;
  const descricao = String(formData.get("descricao") || "").trim() || null;
  if (id) {
    const existente = await prisma.checklistItemModelo.findFirst({ where: { id, contratoId } });
    if (!existente) return { erro: "Item do modelo não encontrado." };
    await prisma.checklistItemModelo.update({ where: { id }, data: { nome, descricao, obrigatorio, temValidade, prazoDiaMesSeguinte, ativo } });
  } else {
    const codigo = nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30);
    const ordem = await prisma.checklistItemModelo.count({ where: { contratoId } });
    await prisma.checklistItemModelo.create({ data: { contratoId, codigo: codigo || `ITEM_${ordem + 1}`, nome, descricao, obrigatorio, temValidade, prazoDiaMesSeguinte, ordem, ativo } });
  }
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: id ? "ATUALIZAR" : "CRIAR", recurso: "Contrato", recursoId: contratoId, resumo: `Checklist mensal: item "${nome}" ${id ? "atualizado" : "criado"} (${obrigatorio ? "obrigatório" : "opcional"}${temValidade ? ", com validade" : ""}${ativo ? "" : ", desativado"})` });
  revalidatePath(`/contratos/${contratoId}`);
  return { ok: true, mensagem: "Modelo salvo. Vale para as próximas competências." };
}

export async function excluirItemModeloAction(id: string): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const item = await prisma.checklistItemModelo.findFirst({ where: { id, contrato: { empresa: { contaId: usuario.contaId } } }, select: { id: true, nome: true, contratoId: true, contrato: { select: { criadoPorId: true } } } });
  if (!item) return { erro: "Item não encontrado." };
  if (!podeEditarDocumento(usuario, item.contrato)) return { erro: mensagemSemPermissao(item.contrato) };
  await prisma.checklistItemModelo.delete({ where: { id } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "EXCLUIR", recurso: "Contrato", recursoId: item.contratoId, resumo: `Checklist mensal: item "${item.nome}" removido do modelo` });
  revalidatePath(`/contratos/${item.contratoId}`);
  return { ok: true, mensagem: "Item removido do modelo (competências já criadas não mudam)." };
}
