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

  const file = formData.get("arquivo") as File | null;
  if (!file || file.size === 0) return { erro: "Anexe o PDF da nota fiscal." };

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
      referencia: `ext-${empenho.id}-${empenho.notasFiscais.length + 1}`,
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

  const ORDEM: Record<string, number> = {
    EMPENHADO: 0, PEDIDO_RECEBIDO: 1, EM_TRANSITO: 2, ENTREGUE: 3,
    NF_EMITIDA: 4, NF_ENCAMINHADA: 5, PAGO: 6,
  };
  const dados: Record<string, unknown> = {
    arquivoNfEmitida: salvo.url,
    // Não sobrescreve data já registrada à mão: a do cliente é a que vale.
    ...(empenho.dataNfEmitida ? {} : { dataNfEmitida: dataValida }),
    ...((ORDEM[empenho.status] ?? 0) < ORDEM.NF_EMITIDA ? { status: "NF_EMITIDA" } : {}),
  };
  await prisma.empenho.update({ where: { id: empenho.id }, data: dados });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "Empenho",
    recursoId: empenho.id,
    resumo:
      `Registrou a nota fiscal do empenho ${empenho.numero}` +
      (lido.numero ? ` (nº ${lido.numero})` : "") +
      (lido.valorTotal ? ` — R$ ${lido.valorTotal.toFixed(2)}` : ""),
  });

  revalidatePath(`/execucao/${empenho.id}`);
  revalidatePath("/execucao");
  revalidatePath("/notas");

  return {
    ok: true,
    aviso,
    lido: { numero: lido.numero, dataEmissao: lido.dataEmissao, valorTotal: lido.valorTotal },
  };
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
