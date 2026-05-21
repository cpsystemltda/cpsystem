"use server";

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import {
  analisarContratoIA,
  analisarDocumentoIA,
  type AnaliseJuridica,
  type DocumentoEntrada,
  type TipoDocJuridico,
} from "@/lib/iaJuridica";

export type AnalisarContratoResult =
  | { ok: true; analise: AnaliseJuridica; demo: boolean }
  | { ok: false; erro: string };

// Mantida pra compat com a UI antiga
export async function analisarContratoAction(contratoId: string): Promise<AnalisarContratoResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId: usuario.contaId } },
    include: { itens: { select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true } } },
  });
  if (!contrato) return { ok: false, erro: "Contrato não encontrado." };
  const demo = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "";
  try {
    const analise = await analisarContratoIA(contrato);
    return { ok: true, analise, demo };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Falha na análise." };
  }
}

// Novo: análise generalizada. Carrega o documento (Ata / Contrato / Empenho)
// da própria conta do usuário e roda IA. Termos de Cooperação ainda não têm
// model próprio — fica preparado pra quando entrar.
export type AnalisarDocumentoResult =
  | { ok: true; analise: AnaliseJuridica; demo: boolean }
  | { ok: false; erro: string };

const ITENS_SELECT = {
  select: { descricao: true, quantidade: true, valorUnitario: true, valorTotal: true },
} as const;

export async function analisarDocumentoJuridicoAction(
  tipo: TipoDocJuridico,
  documentoId: string,
): Promise<AnalisarDocumentoResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  let doc: DocumentoEntrada | null = null;

  if (tipo === "ATA") {
    const a = await prisma.ata.findFirst({
      where: { id: documentoId, empresa: { contaId: usuario.contaId } },
      include: { itens: ITENS_SELECT },
    });
    if (!a) return { ok: false, erro: "Ata não encontrada." };
    doc = {
      tipo: "ATA",
      numero: a.numero,
      subTipo: a.tipo,
      procedimentoSelecao: a.procedimentoSelecao,
      orgaoNome: a.orgaoNome,
      objeto: a.objeto,
      dataAssinatura: a.dataAssinatura,
      dataPublicacao: a.dataPublicacao,
      vigenciaInicio: a.vigenciaInicio,
      vigenciaFim: a.vigenciaFim,
      prazoEntregaDias: a.prazoEntregaDias,
      prazoPagamentoDias: a.prazoPagamentoDias,
      marcoOrcamentoEstimado: a.marcoOrcamentoEstimado,
      marcoReajusteOrigem: a.marcoReajusteOrigem,
      aceitaCarona: a.aceitaCarona,
      itens: a.itens,
    };
  } else if (tipo === "CONTRATO") {
    const c = await prisma.contrato.findFirst({
      where: { id: documentoId, empresa: { contaId: usuario.contaId } },
      include: {
        itens: ITENS_SELECT,
        ata: { select: { numero: true, orgaoNome: true } },
      },
    });
    if (!c) return { ok: false, erro: "Contrato não encontrado." };
    doc = {
      tipo: "CONTRATO",
      numero: c.numero,
      subTipo: c.tipo,
      procedimentoSelecao: c.procedimentoSelecao,
      orgaoNome: c.orgaoNome,
      objeto: c.objeto,
      dataAssinatura: c.dataAssinatura,
      dataPublicacao: c.dataPublicacao,
      vigenciaInicio: c.vigenciaInicio,
      vigenciaFim: c.vigenciaFim,
      prazoEntregaDias: c.prazoEntregaDias,
      prazoPagamentoDias: c.prazoPagamentoDias,
      marcoOrcamentoEstimado: c.marcoOrcamentoEstimado,
      marcoReajusteOrigem: c.marcoReajusteOrigem,
      itens: c.itens,
      contextoAdicional: c.ata
        ? `Derivado da Ata ${c.ata.numero} (${c.ata.orgaoNome}).`
        : "Contrato administrativo autônomo (não vinculado a ARP).",
    };
  } else if (tipo === "EMPENHO") {
    const e = await prisma.empenho.findFirst({
      where: { id: documentoId, empresa: { contaId: usuario.contaId } },
      include: {
        itens: ITENS_SELECT,
        ata: { select: { numero: true } },
        contrato: { select: { numero: true } },
      },
    });
    if (!e) return { ok: false, erro: "Empenho não encontrado." };
    const origem = e.contrato
      ? `Derivado do Contrato ${e.contrato.numero}.`
      : e.ata
        ? `Derivado da Ata ${e.ata.numero}.`
        : "Empenho livre (sem ata ou contrato prévio).";
    doc = {
      tipo: "EMPENHO",
      numero: e.numero,
      subTipo: e.instrumento,
      procedimentoSelecao: e.procedimentoSelecao,
      orgaoNome: e.orgaoNome,
      objeto: e.objeto,
      dataEmissao: e.dataEmissao,
      vigenciaInicio: e.vigenciaInicio,
      vigenciaFim: e.vigenciaFim,
      prazoEntregaDias: e.prazoEntregaDias,
      prazoPagamentoDias: e.prazoPagamentoDias,
      status: e.status,
      itens: e.itens,
      contextoAdicional: origem,
    };
  } else {
    return { ok: false, erro: "Tipo de documento ainda não suportado." };
  }

  const demo = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "";
  try {
    const analise = await analisarDocumentoIA(doc);
    return { ok: true, analise, demo };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Falha na análise." };
  }
}

// Lista documentos da conta pra preencher dropdown do painel jurídico.
export async function listarDocumentosParaAnalise(): Promise<{
  atas: { id: string; rotulo: string }[];
  contratos: { id: string; rotulo: string }[];
  empenhos: { id: string; rotulo: string }[];
}> {
  const usuario = await exigirUsuario();
  const [atas, contratos, empenhos] = await Promise.all([
    prisma.ata.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: { id: true, numero: true, orgaoNome: true },
    }),
    prisma.contrato.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: { id: true, numero: true, orgaoNome: true },
    }),
    prisma.empenho.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: { id: true, numero: true, orgaoNome: true, instrumento: true },
    }),
  ]);
  return {
    atas: atas.map((a) => ({ id: a.id, rotulo: `Ata ${a.numero} — ${a.orgaoNome}` })),
    contratos: contratos.map((c) => ({ id: c.id, rotulo: `Contrato ${c.numero} — ${c.orgaoNome}` })),
    empenhos: empenhos.map((e) => ({
      id: e.id,
      rotulo: `${e.instrumento} ${e.numero} — ${e.orgaoNome}`,
    })),
  };
}
