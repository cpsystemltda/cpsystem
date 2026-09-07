"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarArquivo } from "@/lib/uploads";

/**
 * Registra a nota que o cliente emitiu POR FORA, lendo os dados do PDF.
 *
 * Regina 28/08, ao escolher controle de notas em vez de emissão: o CP System
 * nunca toca no documento fiscal. Aqui ele só recebe a nota pronta, lê número,
 * data e valor para a pessoa não redigitar, e a partir daí passa a contar o
 * prazo de pagamento do órgão.
 *
 * Nada é inventado: campo que a leitura não conseguir extrair fica vazio para
 * a pessoa completar. Chutar número de nota fiscal seria pior que não ler.
 */
export type ResultadoNotaRegistrada = {
  ok?: true;
  erro?: string;
  aviso?: string;
  lido?: {
    numero: string | null;
    dataEmissao: string | null;
    valorTotal: number | null;
  };
};

/** O empenho como as funções auxiliares abaixo precisam dele. */
type EmpenhoParaNota = {
  id: string;
  numero: string;
  status: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string | null;
  orgaoEmail: string | null;
  dataNfEmitida: Date | null;
  empresa: { id: string; cnpj: string };
  itens: { valorTotal: number }[];
  notasFiscais: { id: string }[];
};

export async function registrarNotaEmitidaAction(
  _prev: ResultadoNotaRegistrada | null,
  formData: FormData,
): Promise<ResultadoNotaRegistrada> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenhoId = String(formData.get("empenhoId") || "").trim();
  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true, numero: true, status: true, orgaoNome: true, orgaoCnpj: true,
      orgaoEndereco: true, orgaoEmail: true, dataNfEmitida: true,
      empresa: { select: { id: true, cnpj: true } },
      itens: { select: { valorTotal: true } },
      notasFiscais: { select: { id: true } },
    },
  });
  if (!empenho) return { erro: "Empenho não encontrado." };

  // Igor 07/09: "o mesmo empenho pode ter mais de uma nota fiscal emitida; o
  // campo deve aceitar vários arquivos, sem limite de quantidade". Entrega
  // parcelada gera uma nota por entrega, e antes só cabia uma — a segunda nota
  // não tinha onde ser guardada.
  const arquivos = formData
    .getAll("arquivo")
    .filter((a): a is File => a instanceof File && a.size > 0);
  if (arquivos.length === 0) return { erro: "Anexe o PDF da nota fiscal." };

  const registradas: string[] = [];
  const falhas: string[] = [];
  let avisoGeral: string | undefined;
  let primeiroUrl: string | null = null;
  let primeiraData: Date | null = null;
  let seq = empenho.notasFiscais.length;

  for (const file of arquivos) {
    const r = await registrarUmArquivo(file, empenho, usuario, ++seq);
    if (r.erro) {
      falhas.push(`${file.name}: ${r.erro}`);
      seq--;
      continue;
    }
    registradas.push(file.name);
    if (r.aviso && !avisoGeral) avisoGeral = r.aviso;
    if (!primeiroUrl && r.url) primeiroUrl = r.url;
    if (!primeiraData && r.data) primeiraData = r.data;
  }

  if (registradas.length === 0) {
    return { erro: falhas[0] ?? "Não consegui registrar a nota." };
  }

  return await concluirRegistro({
    empenho, usuario, url: primeiroUrl ?? "", data: primeiraData ?? new Date(),
    quantas: registradas.length, falhas, aviso: avisoGeral,
  });
}

/**
 * Registra UM arquivo como nota do empenho. Isolado para que uma nota com
 * problema não derrube o lote inteiro: o cliente que anexou cinco notas e tem
 * uma ilegível fica com quatro registradas e um aviso, não com zero.
 */
async function registrarUmArquivo(
  file: File,
  empenho: EmpenhoParaNota,
  usuario: { id: string; nome: string },
  sequencial: number,
): Promise<{ erro?: string; aviso?: string; url?: string; data?: Date }> {

  let salvo;
  try {
    salvo = await salvarArquivo(file);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao guardar o arquivo." };
  }

  // Leitura best-effort: se a IA falhar, a nota fica registrada mesmo assim com
  // o arquivo anexado. Perder o anexo por causa da leitura seria o pior dos
  // mundos — o documento é o que importa.
  let lido = {
    numero: null as string | null,
    serie: null as string | null,
    dataEmissao: null as string | null,
    valorTotal: null as number | null,
    codigoVerificacao: null as string | null,
    discriminacao: null as string | null,
  };
  let aviso: string | undefined;
  try {
    const { extrairNotaFiscalDoPdf } = await import("@/lib/extrairAta");
    const r = await extrairNotaFiscalDoPdf(file);
    lido = {
      numero: r.numero, serie: r.serie, dataEmissao: r.dataEmissao,
      valorTotal: r.valorTotal, codigoVerificacao: r.codigoVerificacao,
      discriminacao: r.discriminacao,
    };
    if (!r.numero || !r.dataEmissao) {
      aviso = "Não consegui ler todos os dados do PDF. Confira e complete no empenho.";
    }
  } catch (e) {
    console.error("[nota-registrada] leitura do PDF falhou:", e);
    const { avisarFalhaDeIa, ehFalhaDeCredito } = await import("@/lib/falhaIa");
    await avisarFalhaDeIa("leitura de nota fiscal", e);
    aviso = ehFalhaDeCredito(e)
      ? "A leitura automática está indisponível no momento. A nota foi anexada — informe o número abaixo e seguimos normalmente."
      : "A nota foi anexada, mas não consegui ler os dados dela. Preencha manualmente.";
  }

  const valorItens = empenho.itens.reduce((s, i) => s + i.valorTotal, 0);
  const dataNota = lido.dataEmissao ? new Date(`${lido.dataEmissao}T12:00:00`) : new Date();
  const dataValida = !Number.isNaN(dataNota.getTime()) ? dataNota : new Date();

  await prisma.notaFiscal.create({
    data: {
      empresaId: empenho.empresa.id,
      empenhoId: empenho.id,
      referencia: `ext-${empenho.id}-${sequencial}`,
      provedor: "EXTERNA",
      ambiente: "PRODUCAO",
      status: "AUTORIZADA",
      numero: lido.numero,
      serie: lido.serie,
      codigoVerificacao: lido.codigoVerificacao,
      pdfUrl: salvo.url,
      valorServicos: lido.valorTotal ?? valorItens,
      issRetido: false,
      descricao: lido.discriminacao ?? `Nota do empenho ${empenho.numero}`,
      tomadorCnpj: empenho.orgaoCnpj,
      tomadorRazaoSocial: empenho.orgaoNome,
      tomadorEndereco: empenho.orgaoEndereco,
      tomadorEmail: empenho.orgaoEmail,
      autorizadaEm: dataValida,
      criadoPorId: usuario.id,
      criadoPorNome: usuario.nome,
    },
  });

  return { aviso, url: salvo.url, data: dataValida };
}

/**
 * Fecha o lote: avança o empenho, registra auditoria e revalida as telas.
 *
 * Roda UMA vez por lote, não por arquivo — cinco notas anexadas juntas são um
 * único avanço de etapa e uma única linha de auditoria.
 */
async function concluirRegistro(a: {
  empenho: EmpenhoParaNota;
  usuario: { id: string; nome: string; contaId: string };
  url: string;
  data: Date;
  quantas: number;
  falhas: string[];
  aviso?: string;
}): Promise<ResultadoNotaRegistrada> {
  const { empenho, usuario } = a;

  const ORDEM: Record<string, number> = {
    EMPENHADO: 0, PEDIDO_RECEBIDO: 1, EM_TRANSITO: 2, ENTREGUE: 3,
    NF_EMITIDA: 4, NF_ENCAMINHADA: 5, PAGO: 6,
  };
  await prisma.empenho.update({
    where: { id: empenho.id },
    data: {
      // Guarda o primeiro anexo do lote como referência rápida da etapa; a
      // lista completa vive em NotaFiscal, que aceita quantas forem.
      arquivoNfEmitida: a.url,
      // Não sobrescreve data já registrada à mão: a do cliente é a que vale.
      ...(empenho.dataNfEmitida ? {} : { dataNfEmitida: a.data }),
      ...((ORDEM[empenho.status] ?? 0) < ORDEM.NF_EMITIDA ? { status: "NF_EMITIDA" } : {}),
    },
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "Empenho",
    recursoId: empenho.id,
    resumo:
      a.quantas === 1
        ? `Registrou a nota fiscal do empenho ${empenho.numero}`
        : `Registrou ${a.quantas} notas fiscais do empenho ${empenho.numero}`,
  });

  revalidatePath(`/execucao/${empenho.id}`);
  revalidatePath("/execucao");
  revalidatePath("/notas");

  const partes: string[] = [];
  if (a.quantas > 1) partes.push(`${a.quantas} notas registradas.`);
  if (a.falhas.length) partes.push(`Não consegui registrar: ${a.falhas.join("; ")}`);
  if (a.aviso) partes.push(a.aviso);

  return { ok: true, aviso: partes.length ? partes.join(" ") : undefined };
}

/**
 * Informa apenas o NÚMERO da nota, sem anexar PDF.
 *
 * Igor 28/08, olhando o painel: "o número da nota fiscal não está aparecendo,
 * e eu acho que é o número mais importante pra aparecer". Ele estava certo, e a
 * causa é histórica: o fluxo antigo só registrava DATA e arquivo da nota —
 * número nunca foi pedido. Os oito empenhos com nota do Léo estão todos assim.
 *
 * Pedir o PDF de novo pra recuperar um número que a pessoa tem na mão seria
 * atrito à toa. Aqui ela digita e pronto.
 */
export async function informarNumeroNotaAction(
  _prev: ResultadoNotaRegistrada | null,
  formData: FormData,
): Promise<ResultadoNotaRegistrada> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenhoId = String(formData.get("empenhoId") || "").trim();
  const numero = String(formData.get("numeroNota") || "").trim();
  const serie = String(formData.get("serieNota") || "").trim() || null;
  if (!numero) return { erro: "Informe o número da nota." };
  if (numero.length > 30) return { erro: "Número de nota muito longo." };

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true, numero: true, orgaoNome: true, orgaoCnpj: true, orgaoEndereco: true,
      orgaoEmail: true, dataNfEmitida: true, arquivoNfEmitida: true,
      empresa: { select: { id: true } },
      itens: { select: { valorTotal: true } },
      notasFiscais: { select: { id: true }, take: 1, orderBy: { criadoEm: "desc" } },
    },
  });
  if (!empenho) return { erro: "Empenho não encontrado." };

  const valorItens = empenho.itens.reduce((s, i) => s + i.valorTotal, 0);

  if (empenho.notasFiscais[0]) {
    await prisma.notaFiscal.update({
      where: { id: empenho.notasFiscais[0].id },
      data: { numero, serie },
    });
  } else {
    await prisma.notaFiscal.create({
      data: {
        empresaId: empenho.empresa.id,
        empenhoId: empenho.id,
        referencia: `ext-${empenho.id}-manual`,
        provedor: "EXTERNA",
        ambiente: "PRODUCAO",
        status: "AUTORIZADA",
        numero,
        serie,
        pdfUrl: empenho.arquivoNfEmitida,
        valorServicos: valorItens,
        issRetido: false,
        descricao: `Nota do empenho ${empenho.numero}`,
        tomadorCnpj: empenho.orgaoCnpj,
        tomadorRazaoSocial: empenho.orgaoNome,
        tomadorEndereco: empenho.orgaoEndereco,
        tomadorEmail: empenho.orgaoEmail,
        autorizadaEm: empenho.dataNfEmitida ?? new Date(),
        criadoPorId: usuario.id,
        criadoPorNome: usuario.nome,
      },
    });
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Empenho",
    recursoId: empenho.id,
    resumo: `Informou o número da nota fiscal do empenho ${empenho.numero}: ${numero}`,
  });

  revalidatePath(`/execucao/${empenho.id}`);
  revalidatePath("/execucao");
  revalidatePath("/notas");
  return { ok: true, lido: { numero, dataEmissao: null, valorTotal: null } };
}

/**
 * Remove uma nota anexada ao empenho.
 *
 * Igor 07/09: "adicionar opção de retirar/remover um arquivo já anexado no
 * registro da execução". Anexar o PDF errado acontece, e até agora não havia
 * saída — a nota errada ficava lá para sempre.
 *
 * Só apaga nota de provedor EXTERNA, isto é, a que o cliente emitiu por fora e
 * apenas anexou aqui. NFS-e emitida através do sistema não se apaga: ela existe
 * na prefeitura, e sumir com o registro criaria divergência entre o que o CP
 * System mostra e o que o fisco tem. Essa se cancela, com justificativa.
 */
export async function excluirNotaRegistradaAction(
  _prev: ResultadoNotaRegistrada | null,
  formData: FormData,
): Promise<ResultadoNotaRegistrada> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const notaId = String(formData.get("notaId") || "").trim();
  const nota = await prisma.notaFiscal.findFirst({
    where: { id: notaId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true, numero: true, provedor: true, pdfUrl: true,
      empenho: { select: { id: true, numero: true, arquivoNfEmitida: true } },
    },
  });
  if (!nota) return { erro: "Nota não encontrada." };
  if (nota.provedor !== "EXTERNA") {
    return {
      erro: "Esta nota foi emitida pelo sistema e existe na prefeitura. Use 'Cancelar nota', com justificativa.",
    };
  }

  await prisma.notaFiscal.delete({ where: { id: nota.id } });

  // O empenho guarda o anexo da etapa. Se era justamente este, aponta para
  // outra nota que tenha sobrado — ou limpa, para a etapa não exibir link
  // quebrado de arquivo que não existe mais.
  const empenhoId = nota.empenho?.id;
  if (empenhoId && nota.empenho?.arquivoNfEmitida === nota.pdfUrl) {
    const restante = await prisma.notaFiscal.findFirst({
      where: { empenhoId, pdfUrl: { not: null } },
      select: { pdfUrl: true },
      orderBy: { criadoEm: "asc" },
    });
    await prisma.empenho.update({
      where: { id: empenhoId },
      data: { arquivoNfEmitida: restante?.pdfUrl ?? null },
    });
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "NotaFiscal",
    recursoId: nota.id,
    resumo:
      `Removeu a nota anexada${nota.numero ? ` nº ${nota.numero}` : ""}` +
      (nota.empenho ? ` do empenho ${nota.empenho.numero}` : ""),
  });

  if (empenhoId) revalidatePath(`/execucao/${empenhoId}`);
  revalidatePath("/execucao");
  revalidatePath("/notas");
  return { ok: true };
}
