import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { buscarCompetencia, type ResumoCompetencia } from "@/lib/competenciasServer";
import { garantirChecklist, listarChecklist, type ItemChecklistDto } from "@/lib/checklistMensalServer";
import { ROTULO_REGIME } from "@/lib/regimeLegal";
import { ETAPAS, dataBrDia, rotuloCompetencia } from "@/lib/competencias";
import { ROTULO_STATUS_GLOSA, ROTULO_TIPO_GLOSA, type StatusGlosa, type TipoGlosa } from "@/lib/glosas";
import { ROTULO_TIPO_ALOCACAO, diaUtc, mapaParaItemVigente, type TipoAlocacao } from "@/lib/colaboradores";
import { nomeArquivoDossie, ROTULO_STATUS_ITEM } from "@/lib/checklistMensal";
import { colaboradoresNecessarios } from "@/lib/maoDeObra";
import { itensVigentesEm } from "@/lib/competencias";

/**
 * Dossiê da competência para o fiscal (ESP-010, Igor 07/11/2026): capa,
 * quadro de postos e alocação no mês (CPF mascarado), glosas, checklist e
 * índice dos anexos — em PDF; anexos num ZIP no padrão AAAA-MM_item_doc;
 * quadro de colaboradores em XLSX.
 */

export type AlocacaoDossie = { nome: string; cpfMascarado: string; posto: string; tipo: string; inicio: string; fim: string | null };
export type AnexoDossie = { codigo: string; origem: string; nomeOriginal: string; nomeZip: string; url: string };

export type DadosDossie = {
  competencia: ResumoCompetencia;
  rotulo: string;
  empresa: { razaoSocial: string; cnpj: string };
  contrato: { numero: string; objeto: string; orgao: string; regime: string };
  postos: { descricao: string; necessarios: number; ocupantes: number; descobertos: number }[];
  alocacoes: AlocacaoDossie[];
  nomesOcultos: boolean;
  colaboradoresDistintos: number;
  checklist: ItemChecklistDto[];
  pendencias: string[];
  incompleto: boolean;
  anexos: AnexoDossie[];
  geradoEm: string;
  versao: number;
};

export async function montarDossie(competenciaId: string, contaId: string, podeVerNomes: boolean): Promise<DadosDossie | null> {
  const c = await buscarCompetencia(competenciaId, contaId);
  if (!c) return null;
  const contrato = await prisma.contrato.findUnique({
    where: { id: c.contratoId },
    select: { numero: true, objeto: true, orgaoNome: true, regimeLegal: true, regimeLegalOutro: true, empresa: { select: { razaoSocial: true, cnpj: true } } },
  });
  if (!contrato) return null;
  if (c.tipo === "REGULAR") await garantirChecklist(c.id);
  const checklist = c.tipo === "REGULAR" ? await listarChecklist(c.id) : [];

  const ini = new Date(c.periodoInicio);
  const fim = new Date(c.periodoFim);
  // Postos do período: itens vigentes no fim do período (versão vigente).
  const itens = await prisma.contratoItem.findMany({
    where: { contratoId: c.contratoId, ...(c.vigenciaId ? { vigenciaId: c.vigenciaId } : {}) },
    select: { id: true, descricao: true, quantidade: true, unidadeMaoDeObra: true, colaboradoresPorPosto: true, vigenteDe: true, vigenteAte: true, substituiItemId: true },
    orderBy: { descricao: "asc" },
  });
  const vigentes = itensVigentesEm(itens, fim);
  const paraVigente = mapaParaItemVigente(itens, vigentes);
  // Alocações que tocaram o período.
  const alocs = await prisma.alocacao.findMany({
    where: { contratoId: c.contratoId, dataInicio: { lte: fim }, OR: [{ dataFim: null }, { dataFim: { gte: diaUtc(ini) } }] },
    include: { colaborador: { select: { nome: true, cpfMascarado: true, anonimizadoEm: true } }, contratoItem: { select: { descricao: true } } },
    orderBy: [{ dataInicio: "asc" }],
  });
  alocs.sort((a, b) => (a.contratoItem?.descricao ?? "~").localeCompare(b.contratoItem?.descricao ?? "~", "pt-BR") || a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR"));
  const alocacoes: AlocacaoDossie[] = alocs.map((a) => ({
    nome: podeVerNomes && !a.colaborador.anonimizadoEm ? a.colaborador.nome : "Colaborador",
    cpfMascarado: podeVerNomes ? a.colaborador.cpfMascarado : "***.***.***-**",
    posto: a.contratoItem?.descricao ?? "Volante",
    tipo: ROTULO_TIPO_ALOCACAO[a.tipo as TipoAlocacao],
    inicio: dataBrDia(a.dataInicio > ini ? a.dataInicio : ini),
    fim: a.dataFim && a.dataFim < fim ? dataBrDia(a.dataFim) : null,
  }));
  const postos = vigentes.map((i) => {
    const ocupantes = new Set(alocs.filter((a) => !!a.contratoItemId && (paraVigente.get(a.contratoItemId) ?? a.contratoItemId) === i.id && (!a.dataFim || a.dataFim >= fim) && a.tipo !== "VOLANTE").map((a) => a.colaboradorId)).size;
    const necessarios = colaboradoresNecessarios(i);
    return { descricao: i.descricao, necessarios, ocupantes, descobertos: Math.max(0, necessarios - ocupantes) };
  });

  const pendencias = checklist.filter((i) => i.obrigatorio && !["ENVIADO", "ACEITO", "ANEXADO"].includes(i.status)).map((i) => `${i.nome} (${ROTULO_STATUS_ITEM[i.status].toLowerCase()})`);

  // Anexos: checklist + etapas + glosas.
  const anexos: AnexoDossie[] = [];
  const nomes = new Set<string>();
  const add = (codigo: string, origem: string, nomeOriginal: string, url: string) => {
    let nomeZip = nomeArquivoDossie(c.competencia, codigo, nomeOriginal);
    for (let k = 2; nomes.has(nomeZip); k++) nomeZip = nomeZip.replace(/(\.[a-z0-9]+)?$/i, (ext) => `-${k}${ext}`);
    nomes.add(nomeZip);
    anexos.push({ codigo, origem, nomeOriginal, nomeZip, url });
  };
  for (const i of checklist) for (const a of i.anexos) add(i.codigo, i.nome, a.nome, a.url);
  for (const e of ETAPAS) {
    const url = c.arquivos[e.key];
    if (url) add(e.key, `Etapa: ${e.rotulo}`, `${e.curto}.pdf`, url);
  }
  for (const g of c.glosas) if (g.arquivoUrl) add("GLOSA", `Glosa: ${ROTULO_TIPO_GLOSA[g.tipo as TipoGlosa]} (${dataBrDia(g.data)})`, `glosa-${dataBrDia(g.data).replace(/\//g, "-")}.pdf`, g.arquivoUrl);

  const versao = (await prisma.dossieCompetencia.count({ where: { competenciaId: c.id } })) + 1;
  return {
    competencia: c,
    rotulo: rotuloCompetencia(c.competencia),
    empresa: { razaoSocial: contrato.empresa.razaoSocial, cnpj: contrato.empresa.cnpj },
    contrato: {
      numero: contrato.numero,
      objeto: contrato.objeto,
      orgao: contrato.orgaoNome,
      regime: contrato.regimeLegal === "OUTRO" ? contrato.regimeLegalOutro || "Outro" : contrato.regimeLegal ? ROTULO_REGIME[contrato.regimeLegal] : "não informado",
    },
    postos,
    alocacoes,
    nomesOcultos: !podeVerNomes,
    colaboradoresDistintos: new Set(alocs.map((a) => a.colaboradorId)).size,
    checklist,
    pendencias,
    incompleto: pendencias.length > 0,
    anexos,
    geradoEm: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    versao,
  };
}

export function xlsxQuadro(d: DadosDossie): Buffer {
  const aoa: (string | number | null)[][] = [
    [`Quadro de colaboradores — Contrato ${d.contrato.numero} — competência ${d.rotulo}`],
    [`${d.empresa.razaoSocial} · ${d.contrato.orgao} · período ${dataBrDia(d.competencia.periodoInicio)} a ${dataBrDia(d.competencia.periodoFim)}`],
    [],
    ["Posto / função", "Necessários", "Ocupantes no fim do período", "Descobertos"],
    ...d.postos.map((p) => [p.descricao, p.necessarios, p.ocupantes, p.descobertos]),
    [],
    ["Colaborador", "CPF", "Posto", "Tipo", "De", "Até"],
    ...d.alocacoes.map((a) => [a.nome, a.cpfMascarado, a.posto, a.tipo, a.inicio, a.fim ?? "—"]),
    [],
    [`Gerado pelo CP System em ${d.geradoEm}. CPF mascarado (LGPD).`],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  ws["!merges"] = [0, 1].map((r) => ({ s: { r, c: 0 }, e: { r, c: 5 } }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Quadro de colaboradores");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function nomeBaseDossie(d: DadosDossie): string {
  return `dossie-${d.competencia.competencia}-contrato-${d.contrato.numero.replace(/[^\w.-]+/g, "-")}`;
}

export async function registrarGeracao(d: DadosDossie, formato: "PDF" | "ZIP" | "XLSX", usuarioId: string): Promise<void> {
  await prisma.dossieCompetencia.create({
    data: { competenciaId: d.competencia.id, versao: d.versao, formato, incompleto: d.incompleto, pendencias: d.pendencias, colaboradores: d.colaboradoresDistintos, anexos: d.anexos.length, geradoPorId: usuarioId },
  });
}

export async function historicoDossies(competenciaId: string) {
  const rows = await prisma.dossieCompetencia.findMany({ where: { competenciaId }, orderBy: { geradoEm: "desc" }, take: 20 });
  const ids = [...new Set(rows.map((r) => r.geradoPorId).filter(Boolean) as string[])];
  const us = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : [];
  return rows.map((r) => ({ id: r.id, versao: r.versao, formato: r.formato, incompleto: r.incompleto, colaboradores: r.colaboradores, anexos: r.anexos, geradoEm: r.geradoEm.toISOString(), por: us.find((u) => u.id === r.geradoPorId)?.nome ?? null }));
}

export { ROTULO_STATUS_GLOSA, ROTULO_TIPO_GLOSA };
export type { StatusGlosa };
