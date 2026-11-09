import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { indiceStatus, rotuloCompetencia, type StatusCompetencia } from "@/lib/competencias";
import {
  alertaValidade,
  certidaoCobre,
  indicadorChecklist,
  modeloPorRegime,
  prazoDoItem,
  situacaoChecklist,
  type StatusItemChecklist,
} from "@/lib/checklistMensal";

/**
 * Checklist mensal (ESP-009) — lado do servidor: modelo do contrato, itens
 * de cada competência, reaproveitamento de certidões e a etapa
 * "Documentação trabalhista enviada" marcada sozinha (RN05).
 */

export type AnexoItem = { nome: string; url: string; enviadoEm: string };

export type ItemChecklistDto = {
  id: string;
  codigo: string;
  nome: string;
  obrigatorio: boolean;
  temValidade: boolean;
  ordem: number;
  status: StatusItemChecklist;
  anexos: AnexoItem[];
  validade: string | null;
  alertaValidade: { tipo: "VENCE_EM_BREVE" | "VENCIDA"; dias: number } | null;
  reaproveitado: boolean;
  prazo: string | null;
  atrasado: boolean;
  dataEnvio: string | null;
  dataAceite: string | null;
  motivoDevolucao: string | null;
  observacao: string | null;
};

export type ItemModeloDto = { id: string; codigo: string; nome: string; descricao: string | null; obrigatorio: boolean; temValidade: boolean; prazoDiaMesSeguinte: number | null; ordem: number; ativo: boolean };

function anexosDe(json: unknown): AnexoItem[] {
  return Array.isArray(json) ? (json as AnexoItem[]).filter((a) => a && typeof a.url === "string") : [];
}

/** Modelo do contrato (RN01/RN02): cria pelo regime na primeira vez. */
export async function garantirModeloDoContrato(contratoId: string): Promise<ItemModeloDto[]> {
  const existentes = await prisma.checklistItemModelo.findMany({ where: { contratoId }, orderBy: { ordem: "asc" } });
  if (existentes.length > 0) return existentes;
  const contrato = await prisma.contrato.findUnique({ where: { id: contratoId }, select: { regimeLegal: true } });
  const modelo = modeloPorRegime(contrato?.regimeLegal);
  await prisma.checklistItemModelo.createMany({
    data: modelo.map((m, k) => ({ contratoId, codigo: m.codigo, nome: m.nome, descricao: m.descricao ?? null, obrigatorio: m.obrigatorio, temValidade: !!m.temValidade, prazoDiaMesSeguinte: m.prazoDiaMesSeguinte ?? null, ordem: k, ativo: m.obrigatorio })),
  });
  return prisma.checklistItemModelo.findMany({ where: { contratoId }, orderBy: { ordem: "asc" } });
}

/** Certidão válida mais recente do mesmo código na conta (RN04 + "mesmo arquivo em vários contratos"). */
async function certidaoReaproveitavel(contaId: string, codigo: string, periodoFim: Date) {
  const candidatos = await prisma.checklistItemCompetencia.findMany({
    where: { codigo, temValidade: true, validade: { not: null }, competencia: { contrato: { empresa: { contaId } } } },
    orderBy: { validade: "desc" },
    take: 5,
  });
  return candidatos.find((c) => certidaoCobre(c.validade, periodoFim) && anexosDe(c.anexos).length > 0) ?? null;
}

/** Cria os itens da competência a partir do modelo ativo do contrato (idempotente). */
export async function criarItensDaCompetencia(competenciaId: string): Promise<number> {
  const c = await prisma.competencia.findUnique({
    where: { id: competenciaId },
    select: { id: true, tipo: true, contratoId: true, periodoFim: true, contrato: { select: { empresa: { select: { contaId: true } } } }, itensChecklist: { select: { codigo: true } } },
  });
  if (!c || c.tipo !== "REGULAR") return 0;
  const modelo = (await garantirModeloDoContrato(c.contratoId)).filter((m) => m.ativo);
  const jaTem = new Set(c.itensChecklist.map((i) => i.codigo));
  let criados = 0;
  for (const m of modelo) {
    if (jaTem.has(m.codigo)) continue;
    let anexos: AnexoItem[] = [];
    let validade: Date | null = null;
    let reaproveitadoDeId: string | null = null;
    let status: StatusItemChecklist = "PENDENTE";
    if (m.temValidade) {
      const origem = await certidaoReaproveitavel(c.contrato.empresa.contaId, m.codigo, c.periodoFim);
      if (origem) {
        anexos = anexosDe(origem.anexos);
        validade = origem.validade;
        reaproveitadoDeId = origem.id;
        status = "ANEXADO";
      }
    }
    await prisma.checklistItemCompetencia.create({
      data: { competenciaId, modeloId: m.id, codigo: m.codigo, nome: m.nome, obrigatorio: m.obrigatorio, temValidade: m.temValidade, ordem: m.ordem, status, anexos: anexos.length ? anexos : undefined, validade, reaproveitadoDeId, prazo: prazoDoItem(c.periodoFim, m.prazoDiaMesSeguinte) },
    });
    criados++;
  }
  return criados;
}

export async function garantirChecklist(competenciaId: string): Promise<void> {
  const n = await prisma.checklistItemCompetencia.count({ where: { competenciaId } });
  if (n === 0) await criarItensDaCompetencia(competenciaId);
}

export async function listarChecklist(competenciaId: string, hoje = new Date()): Promise<ItemChecklistDto[]> {
  const itens = await prisma.checklistItemCompetencia.findMany({ where: { competenciaId }, orderBy: { ordem: "asc" } });
  const h = hoje.getTime();
  return itens.map((i) => ({
    id: i.id,
    codigo: i.codigo,
    nome: i.nome,
    obrigatorio: i.obrigatorio,
    temValidade: i.temValidade,
    ordem: i.ordem,
    status: i.status,
    anexos: anexosDe(i.anexos),
    validade: i.validade ? i.validade.toISOString() : null,
    alertaValidade: i.temValidade ? alertaValidade(i.validade, hoje) : null,
    reaproveitado: !!i.reaproveitadoDeId,
    prazo: i.prazo ? i.prazo.toISOString() : null,
    atrasado: !!i.prazo && i.prazo.getTime() < h && !["ENVIADO", "ACEITO"].includes(i.status),
    dataEnvio: i.dataEnvio ? i.dataEnvio.toISOString() : null,
    dataAceite: i.dataAceite ? i.dataAceite.toISOString() : null,
    motivoDevolucao: i.motivoDevolucao,
    observacao: i.observacao,
  }));
}

/**
 * RN05: todos os obrigatórios enviados/aceitos → etapa "Documentação
 * trabalhista enviada" marcada com a data; item devolvido → etapa volta.
 */
export async function sincronizarEtapaDoc(competenciaId: string, usuarioId?: string | null): Promise<"MARCADA" | "DESMARCADA" | "SEM_MUDANCA"> {
  const c = await prisma.competencia.findUnique({
    where: { id: competenciaId },
    select: { id: true, competencia: true, contratoId: true, status: true, dataDocTrabalhista: true, dataMedicao: true, itensChecklist: { select: { obrigatorio: true, status: true, dataEnvio: true } } },
  });
  if (!c || c.itensChecklist.length === 0) return "SEM_MUDANCA";
  const s = situacaoChecklist(c.itensChecklist);
  const contaId = (await prisma.contrato.findUnique({ where: { id: c.contratoId }, select: { empresa: { select: { contaId: true } } } }))?.empresa.contaId;
  if (s.completo && !c.dataDocTrabalhista) {
    const envios = c.itensChecklist.filter((i) => i.obrigatorio && i.dataEnvio).map((i) => (i.dataEnvio as Date).getTime());
    const data = envios.length ? new Date(Math.max(...envios)) : new Date();
    const status: StatusCompetencia = indiceStatus(c.status) < indiceStatus("DOC_TRABALHISTA") ? "DOC_TRABALHISTA" : c.status;
    await prisma.competencia.update({ where: { id: c.id }, data: { dataDocTrabalhista: data, responsavelDocTrabalhista: "Checklist mensal (automático)", status } });
    if (contaId) await registrarAuditoria({ contaId, usuarioId: usuarioId ?? null, acao: "ATUALIZAR", recurso: "Competencia", recursoId: c.id, resumo: `${rotuloCompetencia(c.competencia)}: etapa "Documentação trabalhista enviada" marcada automaticamente — todos os itens obrigatórios do checklist enviados/aceitos` });
    return "MARCADA";
  }
  if (!s.completo && c.dataDocTrabalhista && s.devolvido) {
    const status: StatusCompetencia = c.status === "DOC_TRABALHISTA" ? (c.dataMedicao ? "MEDICAO" : "EM_EXECUCAO") : c.status;
    await prisma.competencia.update({ where: { id: c.id }, data: { dataDocTrabalhista: null, responsavelDocTrabalhista: null, status } });
    if (contaId) await registrarAuditoria({ contaId, usuarioId: usuarioId ?? null, acao: "ATUALIZAR", recurso: "Competencia", recursoId: c.id, resumo: `${rotuloCompetencia(c.competencia)}: item do checklist devolvido pelo órgão — etapa "Documentação trabalhista enviada" voltou a pendente` });
    return "DESMARCADA";
  }
  return "SEM_MUDANCA";
}

/** Certidões reaproveitáveis da conta para um código (UI "reaproveitar"). */
export async function certidoesRecentes(contaId: string, codigo: string, hoje = new Date()): Promise<{ id: string; validade: string; anexos: AnexoItem[]; competencia: string; contratoNumero: string }[]> {
  const rows = await prisma.checklistItemCompetencia.findMany({
    where: { codigo, temValidade: true, validade: { gte: hoje }, competencia: { contrato: { empresa: { contaId } } } },
    orderBy: { validade: "desc" },
    take: 10,
    include: { competencia: { select: { competencia: true, contrato: { select: { numero: true } } } } },
  });
  return rows.filter((r) => anexosDe(r.anexos).length > 0).map((r) => ({ id: r.id, validade: (r.validade as Date).toISOString(), anexos: anexosDe(r.anexos), competencia: r.competencia.competencia, contratoNumero: r.competencia.contrato.numero }));
}

/** RN04: alertas de certidão vencendo nos itens mais recentes do contrato. */
export async function alertasCertidoesDoContrato(contratoId: string, hoje = new Date()): Promise<{ codigo: string; nome: string; validade: string; tipo: "VENCE_EM_BREVE" | "VENCIDA"; dias: number }[]> {
  const rows = await prisma.checklistItemCompetencia.findMany({
    where: { temValidade: true, validade: { not: null }, competencia: { contratoId } },
    orderBy: { validade: "desc" },
    select: { codigo: true, nome: true, validade: true },
  });
  const vistos = new Set<string>();
  const out: { codigo: string; nome: string; validade: string; tipo: "VENCE_EM_BREVE" | "VENCIDA"; dias: number }[] = [];
  for (const r of rows) {
    if (vistos.has(r.codigo)) continue;
    vistos.add(r.codigo);
    const a = alertaValidade(r.validade, hoje);
    if (a) out.push({ codigo: r.codigo, nome: r.nome, validade: (r.validade as Date).toISOString(), ...a });
  }
  return out;
}

/** RN06 por contrato. */
export async function indicadorDoContrato(contratoId: string) {
  const comps = await prisma.competencia.findMany({ where: { contratoId, tipo: "REGULAR" }, select: { periodoFim: true, itensChecklist: { select: { obrigatorio: true, status: true, dataEnvio: true } } } });
  return indicadorChecklist(comps.map((c) => ({ periodoFim: c.periodoFim, itens: c.itensChecklist })));
}
