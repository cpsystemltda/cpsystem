"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { getProvedorFiscal, ErroFiscalConfig } from "@/lib/fiscal";
import type { ResultadoNota } from "@/lib/fiscal";

/**
 * Emissão da NFS-e a partir do empenho (Fase 1).
 *
 * O sistema já tinha os marcos NF_EMITIDA e NF_ENCAMINHADA na esteira, mas eram
 * preenchidos à mão: o cliente emitia a nota em outro lugar e vinha aqui
 * registrar. Isto aqui preenche o buraco do meio — emite de verdade, com os
 * itens e o órgão que já estão cadastrados, e só então avança o marco.
 *
 * Três cuidados que valem mais que o resto do código:
 *
 * 1. IDEMPOTÊNCIA. A nota nasce no nosso banco ANTES de sair pro provedor, com
 *    uma referência única. Se a resposta se perder no caminho, a consulta pela
 *    mesma referência diz o que aconteceu — em vez de emitir uma segunda nota.
 *    Nota fiscal duplicada dá trabalho fiscal pra desfazer.
 * 2. NADA DE AVANÇAR O MARCO SEM AUTORIZAÇÃO. O status do empenho só anda
 *    quando a prefeitura autoriza. Marcar "NF emitida" com a nota em erro é
 *    mentir pro cliente no lugar onde ele confia mais.
 * 3. O ERRO DA PREFEITURA CHEGA INTEIRO NA TELA. Recusa de NFS-e é quase sempre
 *    cadastro errado (item da lista de serviço, inscrição municipal, alíquota),
 *    e a mensagem do provedor é o que permite consertar.
 */

export type ResultadoEmissao = {
  ok?: true;
  mensagem?: string;
  erro?: string;
  notaId?: string;
  status?: ResultadoNota["status"];
};

const ORDEM_MARCO: Record<string, number> = {
  EMPENHADO: 0,
  PEDIDO_RECEBIDO: 1,
  EM_TRANSITO: 2,
  ENTREGUE: 3,
  NF_EMITIDA: 4,
  NF_ENCAMINHADA: 5,
  PAGO: 6,
};

function brl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Texto que sai na nota quando o usuário não escreve um próprio. */
function montarDiscriminacao(
  empenho: { numero: string; processoAdministrativo: string; orgaoNome: string },
  itens: { descricao: string; quantidade: number; unidade: string; valorTotal: number }[],
  descricaoPadrao?: string | null,
): string {
  const linhas = itens.map(
    (i) => `${i.descricao} — ${i.quantidade} ${i.unidade} — ${brl(i.valorTotal)}`,
  );
  return [
    descricaoPadrao?.trim() || null,
    `Empenho ${empenho.numero} — ${empenho.orgaoNome}`,
    empenho.processoAdministrativo ? `Processo ${empenho.processoAdministrativo}` : null,
    ...linhas,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function emitirNotaFiscalAction(
  _prev: ResultadoEmissao | null,
  formData: FormData,
): Promise<ResultadoEmissao> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenhoId = String(formData.get("empenhoId") || "").trim();
  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    include: {
      itens: { select: { descricao: true, quantidade: true, unidade: true, valorTotal: true } },
      empresa: { select: { id: true, cnpj: true, razaoSocial: true } },
      notasFiscais: { select: { id: true, status: true, numero: true } },
    },
  });
  if (!empenho) return { erro: "Empenho não encontrado." };

  // Uma nota autorizada ou em processamento já basta. Emitir por cima é
  // exatamente o erro que dá dor de cabeça fiscal.
  const jaTem = empenho.notasFiscais.find(
    (n) => n.status === "AUTORIZADA" || n.status === "PROCESSANDO",
  );
  if (jaTem) {
    return {
      erro:
        jaTem.status === "AUTORIZADA"
          ? `Este empenho já tem a nota ${jaTem.numero ?? ""} autorizada.`
          : "Já existe uma nota em processamento para este empenho. Atualize em instantes.",
    };
  }

  if (!empenho.dataEntrega) {
    return {
      erro: "Registre a entrega antes de emitir a nota — a nota vem depois do serviço prestado.",
    };
  }

  const valorServicos = empenho.itens.reduce((s, i) => s + i.valorTotal, 0);
  if (valorServicos <= 0) {
    return { erro: "O empenho está sem itens com valor. Cadastre os itens antes de emitir." };
  }

  let ctx;
  try {
    ctx = await getProvedorFiscal(empenho.empresa.id);
  } catch (e) {
    if (e instanceof ErroFiscalConfig) return { erro: e.message };
    throw e;
  }
  const { provedor, config } = ctx;

  const descricaoManual = String(formData.get("descricao") || "").trim();
  const descricao =
    descricaoManual || montarDiscriminacao(empenho, empenho.itens, config.descricaoPadrao);

  const aliquotaBruta = String(formData.get("aliquotaIss") || "").replace(",", ".").trim();
  const aliquotaIss = aliquotaBruta ? Number(aliquotaBruta) : config.aliquotaIss;
  if (aliquotaIss !== null && aliquotaIss !== undefined && Number.isNaN(aliquotaIss)) {
    return { erro: "Alíquota de ISS inválida." };
  }
  const issRetido = formData.get("issRetido") != null
    ? String(formData.get("issRetido")) === "on"
    : config.issRetidoPadrao;

  // Endereço do órgão pela Receita: a prefeitura costuma exigir o tomador com
  // endereço completo, e digitar isso à mão é fonte de recusa. Best-effort —
  // se a consulta falhar, segue com CNPJ e razão social.
  let enderecoTomador = null;
  try {
    const { consultarEnderecoPorCnpj } = await import("@/lib/receitaCnpj");
    enderecoTomador = await consultarEnderecoPorCnpj(empenho.orgaoCnpj);
  } catch (e) {
    console.error("[nota-fiscal] endereço do órgão não veio da Receita:", e);
  }

  const referencia = `emp-${empenho.id}-${empenho.notasFiscais.length + 1}`;

  // Grava ANTES de chamar o provedor: se a resposta se perder, existe rastro e
  // a referência permite consultar em vez de emitir de novo.
  const nota = await prisma.notaFiscal.create({
    data: {
      empresaId: empenho.empresa.id,
      empenhoId: empenho.id,
      referencia,
      provedor: config.provedor,
      ambiente: config.ambiente,
      status: "PROCESSANDO",
      valorServicos,
      aliquotaIss: aliquotaIss ?? null,
      valorIss: aliquotaIss ? Number(((valorServicos * aliquotaIss) / 100).toFixed(2)) : null,
      issRetido,
      descricao,
      tomadorCnpj: empenho.orgaoCnpj,
      tomadorRazaoSocial: empenho.orgaoNome,
      tomadorEndereco: empenho.orgaoEndereco,
      tomadorEmail: empenho.orgaoEmail,
      criadoPorId: usuario.id,
      criadoPorNome: usuario.nome,
    },
  });

  let r: ResultadoNota;
  try {
    r = await provedor.emitir({
      referencia,
      dataEmissao: new Date(),
      naturezaOperacao: config.naturezaOperacao,
      prestador: {
        cnpj: empenho.empresa.cnpj,
        inscricaoMunicipal: config.inscricaoMunicipal,
        codigoMunicipio: config.codigoMunicipio,
        optanteSimples: config.optanteSimples,
        incentivadorCultural: config.incentivadorCultural,
      },
      tomador: {
        cnpj: empenho.orgaoCnpj,
        razaoSocial: empenho.orgaoNome,
        email: empenho.orgaoEmail,
        endereco: enderecoTomador,
      },
      servico: {
        valorServicos,
        discriminacao: descricao,
        itemListaServico: config.itemListaServico,
        codigoTributarioMunicipio: config.codigoTributarioMunicipio,
        cnae: config.cnaeServico,
        aliquotaIss: aliquotaIss ?? null,
        issRetido,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: { status: "ERRO", mensagemErro: `Falha ao falar com o provedor fiscal: ${msg}` },
    });
    console.error("[nota-fiscal] emissão falhou:", e);
    return { erro: `Não consegui falar com o provedor fiscal: ${msg}`, notaId: nota.id };
  }

  await aplicarResultado(nota.id, r);

  if (r.status === "ERRO") {
    return {
      erro: r.mensagemErro || "A prefeitura recusou a nota, sem detalhar o motivo.",
      notaId: nota.id,
      status: r.status,
    };
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "Empenho",
    recursoId: empenho.id,
    resumo:
      `Emitiu NFS-e do empenho ${empenho.numero} (${empenho.orgaoNome}) — ${brl(valorServicos)}` +
      (r.numero ? `, nota ${r.numero}` : "") +
      (config.ambiente === "HOMOLOGACAO" ? " [homologação]" : ""),
  });

  revalidatePath(`/execucao/${empenho.id}`);
  revalidatePath("/execucao");

  return {
    ok: true,
    notaId: nota.id,
    status: r.status,
    mensagem:
      r.status === "AUTORIZADA"
        ? `Nota ${r.numero ?? ""} autorizada.` +
          (config.ambiente === "HOMOLOGACAO"
            ? " Atenção: ambiente de homologação — é nota de teste, sem valor fiscal."
            : "")
        : "Nota enviada. A prefeitura está processando — atualize em instantes.",
  };
}

/**
 * Consulta o provedor e atualiza a nota. Usado pra nota que ficou PROCESSANDO:
 * prefeitura pode levar de segundos a minutos pra autorizar.
 */
export async function consultarNotaFiscalAction(
  _prev: ResultadoEmissao | null,
  formData: FormData,
): Promise<ResultadoEmissao> {
  const usuario = await exigirUsuario();
  const notaId = String(formData.get("notaId") || "").trim();
  const nota = await prisma.notaFiscal.findFirst({
    where: { id: notaId, empresa: { contaId: usuario.contaId } },
    select: { id: true, referencia: true, empresaId: true, status: true },
  });
  if (!nota) return { erro: "Nota não encontrada." };

  try {
    const { provedor } = await getProvedorFiscal(nota.empresaId);
    const r = await provedor.consultar(nota.referencia);
    await aplicarResultado(nota.id, r);
    return {
      ok: true,
      notaId: nota.id,
      status: r.status,
      mensagem:
        r.status === "AUTORIZADA"
          ? `Nota ${r.numero ?? ""} autorizada.`
          : r.status === "ERRO"
            ? r.mensagemErro || "A prefeitura recusou a nota."
            : "Ainda em processamento na prefeitura.",
    };
  } catch (e) {
    if (e instanceof ErroFiscalConfig) return { erro: e.message };
    const msg = e instanceof Error ? e.message : String(e);
    return { erro: `Não consegui consultar: ${msg}` };
  }
}

export async function cancelarNotaFiscalAction(
  _prev: ResultadoEmissao | null,
  formData: FormData,
): Promise<ResultadoEmissao> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (usuario.perfil !== "ADMIN") {
    return { erro: "Só quem administra a conta pode cancelar nota fiscal." };
  }

  const notaId = String(formData.get("notaId") || "").trim();
  const justificativa = String(formData.get("justificativa") || "").trim();
  if (justificativa.length < 15) {
    return { erro: "A prefeitura exige justificativa de pelo menos 15 caracteres." };
  }

  const nota = await prisma.notaFiscal.findFirst({
    where: { id: notaId, empresa: { contaId: usuario.contaId } },
    select: { id: true, referencia: true, empresaId: true, status: true, numero: true, empenhoId: true },
  });
  if (!nota) return { erro: "Nota não encontrada." };
  if (nota.status !== "AUTORIZADA") {
    return { erro: "Só nota autorizada pode ser cancelada." };
  }

  try {
    const { provedor } = await getProvedorFiscal(nota.empresaId);
    const r = await provedor.cancelar(nota.referencia, justificativa);
    await prisma.notaFiscal.update({
      where: { id: nota.id },
      data: {
        status: r.status,
        canceladaEm: r.status === "CANCELADA" ? new Date() : null,
        motivoCancelamento: r.status === "CANCELADA" ? justificativa : null,
        mensagemErro: r.mensagemErro ?? null,
        respostaProvedor: (r.bruto ?? null) as never,
      },
    });

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "Empenho",
      recursoId: nota.empenhoId ?? nota.id,
      resumo: `Cancelou a NFS-e ${nota.numero ?? nota.referencia}: ${justificativa}`,
    });

    if (nota.empenhoId) revalidatePath(`/execucao/${nota.empenhoId}`);
    return {
      ok: r.status === "CANCELADA" ? true : undefined,
      status: r.status,
      erro: r.status === "CANCELADA" ? undefined : r.mensagemErro || "A prefeitura não aceitou o cancelamento.",
      mensagem: r.status === "CANCELADA" ? "Nota cancelada na prefeitura." : undefined,
    };
  } catch (e) {
    if (e instanceof ErroFiscalConfig) return { erro: e.message };
    const msg = e instanceof Error ? e.message : String(e);
    return { erro: `Não consegui cancelar: ${msg}` };
  }
}

/**
 * Grava o resultado do provedor e, só quando AUTORIZADA, avança a esteira.
 *
 * Fica em função separada porque três caminhos chegam aqui — emissão, consulta
 * manual e webhook do provedor — e os três precisam se comportar igual.
 */
export async function aplicarResultado(notaId: string, r: ResultadoNota): Promise<void> {
  const nota = await prisma.notaFiscal.update({
    where: { id: notaId },
    data: {
      status: r.status,
      numero: r.numero ?? undefined,
      serie: r.serie ?? undefined,
      codigoVerificacao: r.codigoVerificacao ?? undefined,
      linkPrefeitura: r.linkPrefeitura ?? undefined,
      pdfUrl: r.pdfUrl ?? undefined,
      xmlUrl: r.xmlUrl ?? undefined,
      mensagemErro: r.mensagemErro ?? null,
      respostaProvedor: (r.bruto ?? null) as never,
      autorizadaEm: r.status === "AUTORIZADA" ? new Date() : undefined,
    },
    select: {
      id: true,
      status: true,
      numero: true,
      pdfUrl: true,
      empenhoId: true,
      empresa: { select: { contaId: true } },
    },
  });

  if (nota.status !== "AUTORIZADA" || !nota.empenhoId) return;

  const empenho = await prisma.empenho.findUnique({
    where: { id: nota.empenhoId },
    select: { id: true, status: true, numero: true, instrumento: true, orgaoNome: true, dataNfEmitida: true },
  });
  if (!empenho) return;

  const dados: Record<string, unknown> = {};
  // Não sobrescreve data já registrada à mão: o cliente pode ter emitido antes
  // por fora e anotado aqui, e a data dele é a que vale pro prazo do órgão.
  if (!empenho.dataNfEmitida) dados.dataNfEmitida = new Date();
  if (nota.pdfUrl) dados.arquivoNfEmitida = nota.pdfUrl;
  if ((ORDEM_MARCO[empenho.status] ?? 0) < ORDEM_MARCO.NF_EMITIDA) {
    dados.status = "NF_EMITIDA";
  }
  if (Object.keys(dados).length > 0) {
    await prisma.empenho.update({ where: { id: empenho.id }, data: dados });
  }

  if (dados.status === "NF_EMITIDA") {
    try {
      const { notificarMudancaStatus } = await import("@/lib/notificacoesWhatsapp");
      await notificarMudancaStatus({
        contaId: nota.empresa.contaId,
        empenhoId: empenho.id,
        numeroEmpenho: empenho.numero,
        instrumento: empenho.instrumento,
        orgao: empenho.orgaoNome,
        novoStatus: "NF_EMITIDA",
      });
    } catch (e) {
      console.error("[nota-fiscal] aviso de mudança de status falhou:", e);
    }
  }
}
