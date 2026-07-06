"use server";

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { prisma } from "@/lib/prisma";
import {
  analisarContratoIA,
  analisarDocumentoIA,
  analisarPdfIA,
  compararDocumentosIA,
  type AnaliseJuridica,
  type ComparacaoJuridica,
  type DocumentoEntrada,
  type TipoDocJuridico,
} from "@/lib/iaJuridica";
import { salvarArquivo } from "@/lib/uploads";

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
      const parecer = await prisma.parecerJuridico.create({
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
      // Notifica WhatsApp — novo parecer disponivel (best-effort).
      try {
        const { notificarParecerJuridico } = await import("@/lib/notificacoesWhatsapp");
        await notificarParecerJuridico({
          contaId: usuario.contaId,
          parecerId: parecer.id,
          titulo: `Análise de ${tipo.toLowerCase()}`,
          documentoTipo: tipo,
        });
      } catch (e) {
        console.error("[notif parecer]", e);
      }
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
  avulsos: { id: string; rotulo: string; pdfUrl: string; tipo: string }[];
}> {
  const usuario = await exigirUsuario();
  const [atas, contratos, empenhos, avulsos] = await Promise.all([
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
    prisma.documentoAvulsoJuridico.findMany({
      where: { empresa: { contaId: usuario.contaId } },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: { id: true, nome: true, tipo: true, pdfUrl: true },
    }),
  ]);
  return {
    atas: atas.map((a) => ({ id: a.id, rotulo: `Ata ${a.numero} — ${a.orgaoNome}` })),
    contratos: contratos.map((c) => ({ id: c.id, rotulo: `Contrato ${c.numero} — ${c.orgaoNome}` })),
    empenhos: empenhos.map((e) => ({
      id: e.id,
      rotulo: `${e.instrumento} ${e.numero} — ${e.orgaoNome}`,
    })),
    avulsos: avulsos.map((a) => ({
      id: a.id,
      rotulo: `${rotuloAvulso(a.tipo)} · ${a.nome}`,
      pdfUrl: a.pdfUrl,
      tipo: a.tipo,
    })),
  };
}

function rotuloAvulso(tipo: string): string {
  switch (tipo) {
    case "TERMO_COOPERACAO": return "Termo de Cooperação";
    case "MINUTA": return "Minuta";
    case "ADITIVO": return "Aditivo";
    default: return "Documento avulso";
  }
}

// ============================================================
// UPLOAD + ANALISE DE PDF AVULSO (Regina 06/07)
// Suporta TC (Termo de Cooperação), minutas, aditivos — qualquer
// PDF que não é modelado como entidade no sistema.
// ============================================================

export type UploadAvulsoResult =
  | { ok: true; id: string; nome: string; tipo: string; pdfUrl: string }
  | { ok: false; erro: string };

// Recebe FormData com { arquivo: File, tipo: string, empresaId?: string }.
// Salva PDF no Vercel Blob + cria registro DocumentoAvulsoJuridico.
export async function uploadDocumentoAvulsoAction(form: FormData): Promise<UploadAvulsoResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const arquivo = form.get("arquivo");
  const tipo = String(form.get("tipo") ?? "OUTRO");
  const empresaIdInput = form.get("empresaId");

  if (!(arquivo instanceof File)) return { ok: false, erro: "Nenhum arquivo enviado." };
  if (arquivo.type !== "application/pdf") return { ok: false, erro: "Apenas PDFs são aceitos aqui." };
  const tiposValidos = ["TERMO_COOPERACAO", "MINUTA", "ADITIVO", "OUTRO"];
  if (!tiposValidos.includes(tipo)) return { ok: false, erro: "Tipo inválido." };

  let empresaId = empresaIdInput ? String(empresaIdInput) : null;
  if (!empresaId) {
    const primeira = await prisma.empresa.findFirst({
      where: { contaId: usuario.contaId },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    });
    if (!primeira) return { ok: false, erro: "Nenhuma empresa cadastrada. Cadastre uma empresa antes." };
    empresaId = primeira.id;
  } else {
    const pertence = await prisma.empresa.count({
      where: { id: empresaId, contaId: usuario.contaId },
    });
    if (!pertence) return { ok: false, erro: "Empresa não pertence à sua conta." };
  }

  const salvo = await salvarArquivo(arquivo);
  const registro = await prisma.documentoAvulsoJuridico.create({
    data: {
      empresaId,
      tipo,
      nome: salvo.nome,
      pdfUrl: salvo.url,
      tamanhoBytes: salvo.tamanhoBytes,
      criadoPorId: usuario.id,
    },
  });
  return { ok: true, id: registro.id, nome: registro.nome, tipo: registro.tipo, pdfUrl: registro.pdfUrl };
}

// Analisa PDF avulso (previamente uploadado) via IA. Persiste parecer.
export async function analisarAvulsoAction(avulsoId: string): Promise<AnalisarDocumentoResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const avulso = await prisma.documentoAvulsoJuridico.findFirst({
    where: { id: avulsoId, empresa: { contaId: usuario.contaId } },
    select: { id: true, tipo: true, nome: true, pdfUrl: true },
  });
  if (!avulso) return { ok: false, erro: "Documento não encontrado." };

  const demo = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "";
  try {
    const analise = await analisarPdfIA({
      pdfUrl: avulso.pdfUrl,
      nomeDocumento: avulso.nome,
      tipoDeclarado: avulso.tipo,
    });
    await prisma.parecerJuridico.create({
      data: {
        tipo: "AVULSO",
        analise: analise as unknown as object,
        modelo: MODELO_ATUAL,
        demo,
        avulsoId: avulso.id,
        criadoPorId: usuario.id,
      },
    });
    return { ok: true, analise, demo };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Falha na análise do PDF." };
  }
}

// ============================================================
// COMPARACAO DE 2 DOCUMENTOS (Regina 06/07)
// Recebe 2 avulsoIds e retorna análise de diferenças.
// Não persiste (comparação é pontual, não parecer arquivado).
// ============================================================

export type CompararResult =
  | { ok: true; comparacao: ComparacaoJuridica; demo: boolean }
  | { ok: false; erro: string };

export async function compararAvulsosAction(
  avulsoIdOriginal: string,
  avulsoIdAlterado: string,
): Promise<CompararResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  if (avulsoIdOriginal === avulsoIdAlterado) {
    return { ok: false, erro: "Escolha 2 documentos diferentes." };
  }

  const [orig, alt] = await Promise.all([
    prisma.documentoAvulsoJuridico.findFirst({
      where: { id: avulsoIdOriginal, empresa: { contaId: usuario.contaId } },
      select: { id: true, nome: true, pdfUrl: true },
    }),
    prisma.documentoAvulsoJuridico.findFirst({
      where: { id: avulsoIdAlterado, empresa: { contaId: usuario.contaId } },
      select: { id: true, nome: true, pdfUrl: true },
    }),
  ]);
  if (!orig || !alt) return { ok: false, erro: "Um dos documentos não foi encontrado." };

  const demo = !process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "";
  try {
    const comparacao = await compararDocumentosIA({
      pdfUrlOriginal: orig.pdfUrl,
      nomeOriginal: orig.nome,
      pdfUrlAlterado: alt.pdfUrl,
      nomeAlterado: alt.nome,
    });
    return { ok: true, comparacao, demo };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Falha na comparação." };
  }
}
