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

const MODELO_ATUAL = "claude-sonnet-4-6";

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
    // Persiste o parecer pra evitar re-análise (gasto de tokens) e dar
    // histórico. Falha silenciosa — se gravar der ruim, ainda retornamos
    // a análise pro usuário (degrada graciosamente).
    try {
      await prisma.parecerJuridico.create({
        data: {
          tipo,
          analise: analise as unknown as object,
          modelo: MODELO_ATUAL,
          demo,
          ataId: tipo === "ATA" ? documentoId : null,
          contratoId: tipo === "CONTRATO" ? documentoId : null,
          empenhoId: tipo === "EMPENHO" ? documentoId : null,
          criadoPorId: usuario.id,
        },
      });
    } catch (errSalvar) {
      console.warn("[analisarDocumentoJuridicoAction] falha ao salvar parecer:", errSalvar);
    }
    return { ok: true, analise, demo };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Falha na análise." };
  }
}

// Lista pareceres salvos pra um documento específico (mais recente primeiro).
// Retorna metadados (id, data, modelo, demo) e SEM o payload — usado pra
// montar o seletor de versões. Pra ler o conteúdo, usar lerParecerAction.
export type ParecerListItem = {
  id: string;
  modelo: string;
  demo: boolean;
  criadoEm: Date;
  criadoPorNome: string | null;
};

export async function listarPareceresAction(
  tipo: TipoDocJuridico,
  documentoId: string,
): Promise<ParecerListItem[]> {
  const usuario = await exigirUsuario();
  // Garante que o documento pertence à conta do usuário antes de listar
  // pareceres — defesa-em-profundidade contra ID enumeration.
  const pertence = await verificarPropriedadeDoc(usuario.contaId, tipo, documentoId);
  if (!pertence) return [];

  const where =
    tipo === "ATA"
      ? { ataId: documentoId }
      : tipo === "CONTRATO"
        ? { contratoId: documentoId }
        : tipo === "EMPENHO"
          ? { empenhoId: documentoId }
          : null;
  if (!where) return [];

  const lista = await prisma.parecerJuridico.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      modelo: true,
      demo: true,
      criadoEm: true,
      criadoPor: { select: { nome: true } },
    },
    take: 20,
  });
  return lista.map((p) => ({
    id: p.id,
    modelo: p.modelo,
    demo: p.demo,
    criadoEm: p.criadoEm,
    criadoPorNome: p.criadoPor?.nome ?? null,
  }));
}

export type LerParecerResult =
  | { ok: true; analise: AnaliseJuridica; demo: boolean; modelo: string; criadoEm: Date }
  | { ok: false; erro: string };

// Lê um parecer salvo (pra re-visualização). Valida que pertence à conta
// do usuário via documento pai — pareceres em si não têm contaId direto.
export async function lerParecerAction(parecerId: string): Promise<LerParecerResult> {
  const usuario = await exigirUsuario();
  const p = await prisma.parecerJuridico.findUnique({
    where: { id: parecerId },
    select: {
      analise: true,
      modelo: true,
      demo: true,
      criadoEm: true,
      ataId: true,
      contratoId: true,
      empenhoId: true,
    },
  });
  if (!p) return { ok: false, erro: "Parecer não encontrado." };

  const tipo: TipoDocJuridico = p.ataId
    ? "ATA"
    : p.contratoId
      ? "CONTRATO"
      : "EMPENHO";
  const docId = p.ataId ?? p.contratoId ?? p.empenhoId ?? "";
  const pertence = await verificarPropriedadeDoc(usuario.contaId, tipo, docId);
  if (!pertence) return { ok: false, erro: "Parecer não pertence à sua conta." };

  return {
    ok: true,
    analise: p.analise as unknown as AnaliseJuridica,
    demo: p.demo,
    modelo: p.modelo,
    criadoEm: p.criadoEm,
  };
}

async function verificarPropriedadeDoc(
  contaId: string,
  tipo: TipoDocJuridico,
  documentoId: string,
): Promise<boolean> {
  if (tipo === "ATA") {
    const c = await prisma.ata.count({
      where: { id: documentoId, empresa: { contaId } },
    });
    return c > 0;
  }
  if (tipo === "CONTRATO") {
    const c = await prisma.contrato.count({
      where: { id: documentoId, empresa: { contaId } },
    });
    return c > 0;
  }
  if (tipo === "EMPENHO") {
    const c = await prisma.empenho.count({
      where: { id: documentoId, empresa: { contaId } },
    });
    return c > 0;
  }
  return false;
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
