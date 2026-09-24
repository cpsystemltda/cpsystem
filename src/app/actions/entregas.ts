"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { salvarArquivo } from "@/lib/uploads";
import { situacaoEntrega, type TipoEntrega } from "@/lib/entregas";

/**
 * Registra uma entrega (ou uma inexecução) de um fornecimento.
 *
 * Demanda de cliente 23/09/2026. Antes, a etapa "Entregue" era uma data e
 * nada mais. Agora ela é um evento com natureza: entrega total, parcial,
 * inexecução total ou parcial — e, na parcial, com o quantitativo de cada
 * item que saiu naquela data.
 *
 * Duas decisões que o resto do sistema depende:
 *
 * 1. **`dataEntrega` e `status: ENTREGUE` só quando a entrega FECHA.** É esse
 *    par que destrava a nota fiscal na esteira. Enquanto falta quantidade, o
 *    empenho continua no status anterior e a linha do tempo pede "Entrega 2".
 * 2. **Inexecução total nunca fecha.** Ela trava — e é `registrarMarcoAction`
 *    que recusa avançar, porque a trava tem que valer mesmo se alguém chamar a
 *    etapa seguinte por outro caminho.
 */
const TIPOS: TipoEntrega[] = ["TOTAL", "PARCIAL", "INEXECUCAO_TOTAL", "INEXECUCAO_PARCIAL"];

function parseDataInputBr(dataIso: string): Date | null {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null;
  const d = new Date(dataIso + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

export async function registrarEntregaAction(
  _p: { erro?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const empenhoId = String(formData.get("empenhoId") || "");
  const tipo = String(formData.get("tipo") || "") as TipoEntrega;
  const dataIso = String(formData.get("data") || "");
  const observacao = String(formData.get("observacao") || "").trim();

  if (!TIPOS.includes(tipo)) return { erro: "Escolha o tipo de entrega." };
  const data = parseDataInputBr(dataIso);
  if (!data) return { erro: "Data inválida." };

  const empenho = await prisma.empenho.findFirst({
    where: { id: empenhoId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true, status: true, dataEntrega: true, numero: true, empresaId: true,
      itens: { select: { id: true, descricao: true, unidade: true, quantidade: true } },
      entregas: {
        select: {
          id: true, ordem: true, tipo: true, data: true, observacao: true, arquivoUrl: true,
          itens: { select: { itemId: true, quantidade: true } },
        },
      },
    },
  });
  if (!empenho) return { erro: "Fornecimento não encontrado." };

  const antes = situacaoEntrega(empenho.itens, empenho.entregas);
  if (antes.inexecucaoTotal) {
    return { erro: "Este fornecimento está marcado como inexecução total. Desfaça esse registro antes de lançar uma entrega." };
  }
  if (antes.completa) {
    return { erro: "A entrega deste fornecimento já está concluída." };
  }

  // Quantitativos da entrega parcial. Aceita só o que ainda falta: lançar mais
  // do que foi empenhado não é entrega, é erro de digitação — e passaria
  // despercebido na soma.
  const itensDaEntrega: { itemId: string; quantidade: number }[] = [];
  if (tipo === "PARCIAL") {
    for (const item of empenho.itens) {
      const bruto = String(formData.get(`item_${item.id}`) || "").replace(",", ".").trim();
      if (!bruto) continue;
      const qtd = Number(bruto);
      if (!Number.isFinite(qtd) || qtd < 0) {
        return { erro: `Quantidade inválida em "${item.descricao}".` };
      }
      if (qtd === 0) continue;
      const jaEntregue = antes.entreguePorItem.get(item.id) ?? 0;
      const falta = item.quantidade - jaEntregue;
      if (qtd > falta + 1e-9) {
        return {
          erro: `"${item.descricao}": você lançou ${qtd} ${item.unidade}, mas faltam só ${Number(falta.toFixed(4))} ${item.unidade}.`,
        };
      }
      itensDaEntrega.push({ itemId: item.id, quantidade: qtd });
    }
    if (itensDaEntrega.length === 0) {
      return { erro: "Informe a quantidade entregue de pelo menos um item." };
    }
  }

  let arquivoUrl: string | null = null;
  const file = formData.get("arquivo") as File | null;
  if (file && file.size > 0) {
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Falha ao salvar arquivo." };
    }
  }

  const criada = await prisma.entregaEmpenho.create({
    data: {
      empenhoId,
      ordem: antes.proximaOrdem,
      tipo,
      data,
      observacao: observacao || null,
      arquivoUrl,
      criadoPorId: usuario.id,
      itens: itensDaEntrega.length > 0 ? { create: itensDaEntrega } : undefined,
    },
    select: { id: true },
  });

  // Recalcula com a entrega nova dentro: é o mesmo cálculo das telas, então
  // não existe divergência entre o que a esteira faz e o que o cliente vê.
  const depois = situacaoEntrega(empenho.itens, [
    ...empenho.entregas,
    { id: criada.id, ordem: antes.proximaOrdem, tipo, data, observacao: null, arquivoUrl: null, itens: itensDaEntrega },
  ]);

  if (depois.completa && !depois.inexecucaoTotal) {
    await prisma.empenho.update({
      where: { id: empenhoId },
      data: {
        dataEntrega: data,
        // Não regride: empenho que já passou da entrega continua onde está.
        ...(["EMPENHADO", "PEDIDO_RECEBIDO", "EM_TRANSITO"].includes(empenho.status)
          ? { status: "ENTREGUE" as const }
          : {}),
      },
    });

    // Mesmo aviso de sempre ("hora de solicitar a nota"), agora disparado no
    // momento certo: quando a entrega fecha, não na primeira parcela.
    if (!empenho.dataEntrega) {
      try {
        const { avisarParaSolicitarNota } = await import("@/lib/solicitarNota");
        await avisarParaSolicitarNota(empenhoId);
      } catch (e) {
        console.error("[entrega] aviso de solicitar nota falhou:", e);
      }
    }
  }

  revalidatePath(`/execucao/${empenhoId}`);
  revalidatePath("/execucao");
  return { ok: true };
}

/**
 * Apaga uma entrega registrada.
 *
 * Se a entrega apagada era a que fechava o ciclo, o empenho volta a ter
 * entrega em aberto — e a nota fiscal volta a ficar trancada. Deixar
 * `dataEntrega` para trás aqui seria manter a esteira destravada sobre uma
 * entrega que não existe mais.
 */
export async function desfazerEntregaAction(
  _p: { erro?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ erro?: string; ok?: boolean }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const entregaId = String(formData.get("entregaId") || "");
  const entrega = await prisma.entregaEmpenho.findFirst({
    where: { id: entregaId, empenho: { empresa: { contaId: usuario.contaId } } },
    select: { id: true, empenhoId: true },
  });
  if (!entrega) return { erro: "Entrega não encontrada." };

  await prisma.entregaEmpenho.delete({ where: { id: entrega.id } });

  const empenho = await prisma.empenho.findUnique({
    where: { id: entrega.empenhoId },
    select: {
      id: true, status: true,
      itens: { select: { id: true, descricao: true, unidade: true, quantidade: true } },
      entregas: {
        select: {
          id: true, ordem: true, tipo: true, data: true, observacao: true, arquivoUrl: true,
          itens: { select: { itemId: true, quantidade: true } },
        },
      },
    },
  });

  if (empenho) {
    const agora = situacaoEntrega(empenho.itens, empenho.entregas);
    if (!agora.completa) {
      await prisma.empenho.update({
        where: { id: empenho.id },
        data: {
          dataEntrega: null,
          ...(empenho.status === "ENTREGUE" ? { status: "EM_TRANSITO" as const } : {}),
        },
      });
    }
  }

  revalidatePath(`/execucao/${entrega.empenhoId}`);
  revalidatePath("/execucao");
  return { ok: true };
}
