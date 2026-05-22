"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { isContratoNaoContinuado, ROTULO_TIPO } from "@/lib/validators";

type Result = { ok: true } | { ok: false; erro: string };

/**
 * Inicia manualmente uma nova vigência num contrato continuado ou ata —
 * sem precisar de Termo Aditivo. Caso de uso: prorrogação informal,
 * extensão administrativa, ou correção de vigência mal cadastrada.
 *
 * Política:
 *  - Cria Vigencia (ordem N+1) com datas e valor informados
 *  - copiarItens=true (default): replica itens da vigência anterior. Sem
 *    reajuste — quando o usuário aciona o botão manual, ele assume controle.
 *  - copiarItens=false: nova vigência fica sem itens (usuário adiciona depois)
 *  - Bloqueado em contratos NÃO continuados (Lei 14.133 — itens entrega única)
 *  - Empenhos novos caem aqui automaticamente via dataEmissao (resolução
 *    em criarEmpenhoAction)
 */
export async function iniciarNovaVigenciaAction(formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();

  const contratoId = String(formData.get("contratoId") || "").trim() || null;
  const ataId = String(formData.get("ataId") || "").trim() || null;
  const dataInicioStr = String(formData.get("dataInicio") || "").trim();
  const dataFimStr = String(formData.get("dataFim") || "").trim();
  const valorTotalStr = String(formData.get("valorTotal") || "").trim();
  const copiarItens = String(formData.get("copiarItens") || "true") !== "false";
  const observacao = String(formData.get("observacao") || "").trim() || null;

  if (!contratoId && !ataId) return { ok: false, erro: "Informe contratoId ou ataId." };
  if (!dataInicioStr || !dataFimStr) {
    return { ok: false, erro: "Datas de início e fim são obrigatórias." };
  }
  const dataInicio = new Date(dataInicioStr);
  const dataFim = new Date(dataFimStr);
  if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
    return { ok: false, erro: "Datas inválidas." };
  }
  if (dataFim <= dataInicio) {
    return { ok: false, erro: "Data fim deve ser depois da data início." };
  }

  // Valida propriedade do contrato/ata e tipo (não pode ser contrato
  // não-continuado).
  if (contratoId) {
    const c = await prisma.contrato.findFirst({
      where: { id: contratoId, empresa: { contaId: usuario.contaId } },
      select: { tipo: true },
    });
    if (!c) return { ok: false, erro: "Contrato não encontrado." };
    if (isContratoNaoContinuado(c.tipo)) {
      return {
        ok: false,
        erro: `Contratos do tipo "${ROTULO_TIPO[c.tipo]}" não admitem nova vigência (Lei 14.133 — entrega única).`,
      };
    }
  } else if (ataId) {
    const a = await prisma.ata.findFirst({
      where: { id: ataId, empresa: { contaId: usuario.contaId } },
      select: { id: true },
    });
    if (!a) return { ok: false, erro: "Ata não encontrada." };
  }

  try {
    // Pega vigência anterior pra determinar próxima ordem + (opcionalmente)
    // copiar itens.
    const vigAtual = await prisma.vigencia.findFirst({
      where: contratoId ? { contratoId } : { ataId: ataId! },
      orderBy: { ordem: "desc" },
      include: { contratoItens: true, ataItens: true },
    });
    if (!vigAtual) {
      return {
        ok: false,
        erro: "Vigência anterior não encontrada. Backfill incompleto?",
      };
    }

    // Valor total: se usuário informou, usa; senão soma dos itens copiados
    // (se copiarItens=true) OU valor da anterior.
    let valorTotal: number;
    if (valorTotalStr) {
      const v = Number(valorTotalStr.replace(/\./g, "").replace(",", "."));
      if (isNaN(v) || v < 0) return { ok: false, erro: "Valor total inválido." };
      valorTotal = v;
    } else if (copiarItens) {
      const itensFonte = contratoId ? vigAtual.contratoItens : vigAtual.ataItens;
      valorTotal = itensFonte.reduce((s, it) => s + it.valorTotal, 0);
    } else {
      valorTotal = vigAtual.valorTotal;
    }

    const novaVig = await prisma.vigencia.create({
      data: {
        ordem: vigAtual.ordem + 1,
        dataInicio,
        dataFim,
        valorTotal,
        contratoId,
        ataId,
        observacao: observacao ?? "Vigência iniciada manualmente",
      },
      select: { id: true, ordem: true },
    });

    if (copiarItens) {
      if (contratoId) {
        for (const it of vigAtual.contratoItens) {
          await prisma.contratoItem.create({
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca,
              valorUnitario: it.valorUnitario,
              valorTotal: it.valorTotal,
              moeda: it.moeda,
              contratoId,
              ataItemId: it.ataItemId,
              vigenciaId: novaVig.id,
            },
          });
        }
      } else if (ataId) {
        for (const it of vigAtual.ataItens) {
          await prisma.ataItem.create({
            data: {
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              marca: it.marca,
              valorUnitario: it.valorUnitario,
              valorTotal: it.valorTotal,
              moeda: it.moeda,
              lote: it.lote,
              numero: it.numero,
              ataId,
              vigenciaId: novaVig.id,
            },
          });
        }
      }
    }

    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "CRIAR",
      recurso: "Vigencia",
      recursoId: novaVig.id,
      resumo: `Vigência ${novaVig.ordem}ª iniciada manualmente${copiarItens ? " (itens copiados)" : " (sem itens)"}`,
    });

    revalidatePath(contratoId ? `/contratos/${contratoId}` : `/atas/${ataId}`);
    return { ok: true };
  } catch (err) {
    console.error("[iniciarNovaVigenciaAction]", err);
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Falha ao iniciar nova vigência.",
    };
  }
}
