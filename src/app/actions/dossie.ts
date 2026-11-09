"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { bloqueioModulo } from "@/lib/faixasTerceirizacaoServer";
import { registrarAuditoria } from "@/lib/auditoria";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { indiceStatus, rotuloCompetencia, type StatusCompetencia } from "@/lib/competencias";

/** ESP-010 RN04: marcar "Documentação trabalhista enviada" a partir do dossiê gerado. */
export async function marcarDocPeloDossieAction(competenciaId: string, dataIso: string): Promise<{ ok?: boolean; erro?: string; mensagem?: string }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId, "leitura");
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const c = await prisma.competencia.findFirst({
    where: { id: competenciaId, contrato: { empresa: { contaId: usuario.contaId } } },
    select: { id: true, competencia: true, status: true, contratoId: true, dataDocTrabalhista: true, contrato: { select: { criadoPorId: true } } },
  });
  if (!c) return { erro: "Competência não encontrada." };
  if (!podeEditarDocumento(usuario, c.contrato)) return { erro: mensagemSemPermissao(c.contrato) };
  if (c.dataDocTrabalhista) return { ok: true, mensagem: "A etapa já estava marcada." };
  const ultimo = await prisma.dossieCompetencia.findFirst({ where: { competenciaId }, orderBy: { geradoEm: "desc" } });
  if (!ultimo) return { erro: "Gere o dossiê antes." };
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataIso) ? new Date(`${dataIso}T12:00:00.000Z`) : new Date();
  const status: StatusCompetencia = indiceStatus(c.status) < indiceStatus("DOC_TRABALHISTA") ? "DOC_TRABALHISTA" : c.status;
  await prisma.competencia.update({ where: { id: c.id }, data: { dataDocTrabalhista: data, responsavelDocTrabalhista: `${usuario.nome ?? usuario.email} (dossiê v${ultimo.versao})`, status } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "Competencia", recursoId: c.id, resumo: `${rotuloCompetencia(c.competencia)}: "Documentação trabalhista enviada" marcada pelo dossiê v${ultimo.versao}${ultimo.incompleto ? " (incompleto)" : ""}` });
  revalidatePath(`/competencias/${c.id}`);
  revalidatePath(`/contratos/${c.contratoId}`);
  return { ok: true, mensagem: "Etapa “Documentação trabalhista enviada” marcada com o dossiê." };
}
