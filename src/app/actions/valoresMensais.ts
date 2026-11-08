"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { isContratoMaoDeObra } from "@/lib/validators";
import { mesesDaVigencia } from "@/lib/maoDeObra";

type Result = { ok?: boolean; erro?: string } | null;

/**
 * ESP-002 RN06 (Igor 07/11/2026): contrato de mão de obra cadastrado antes
 * do módulo tem itens cujo valor pode ser mensal ou da vigência inteira. O
 * banner pergunta; a resposta fica registrada e muda o cálculo:
 * - MENSAL: nada nos itens; a vigência passa a valer mensal × meses.
 * - VIGENCIA: cada item é dividido pelos meses da sua vigência (vira
 *   mensal) e a vigência volta ao mesmo total de antes.
 */
export async function confirmarValoresMensaisAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  const contratoId = String(formData.get("contratoId") || "").trim();
  const modo = String(formData.get("modo") || "").trim();
  if (!contratoId) return { erro: "Contrato não informado." };
  if (modo !== "MENSAL" && modo !== "VIGENCIA") return { erro: "Escolha uma das duas opções." };

  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, empresa: { contaId: usuario.contaId } },
    select: {
      id: true,
      tipo: true,
      numero: true,
      criadoPorId: true,
      responsavelId: true,
      valoresMensaisConfirmadosEm: true,
      vigenciaInicio: true,
      vigenciaFim: true,
      vigencias: { select: { id: true, ordem: true, dataInicio: true, dataFim: true } },
      itens: { select: { id: true, descricao: true, quantidade: true, valorUnitario: true, vigenciaId: true } },
    },
  });
  if (!contrato) return { erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { erro: mensagemSemPermissao(contrato) };
  if (!isContratoMaoDeObra(contrato.tipo)) return { erro: "Este contrato não é de mão de obra." };
  if (contrato.valoresMensaisConfirmadosEm) return { ok: true };

  const agora = new Date();
  let resumo: string;
  if (modo === "MENSAL") {
    await prisma.contrato.update({ where: { id: contrato.id }, data: { valoresMensaisConfirmadosEm: agora } });
    resumo = "Valores dos itens confirmados como MENSAIS; o valor da vigência passa a ser mensal × meses.";
  } else {
    const vigPorId = new Map(contrato.vigencias.map((v) => [v.id, v]));
    const linhas: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const it of contrato.itens) {
        const v = it.vigenciaId ? vigPorId.get(it.vigenciaId) : null;
        const meses = mesesDaVigencia(v?.dataInicio ?? contrato.vigenciaInicio, v?.dataFim ?? contrato.vigenciaFim) || 1;
        const novoUnit = Math.round((it.valorUnitario / meses) * 100) / 100;
        await tx.contratoItem.update({
          where: { id: it.id },
          data: { valorUnitario: novoUnit, valorTotal: Math.round(it.quantidade * novoUnit * 100) / 100 },
        });
        linhas.push(`${it.descricao.slice(0, 40)}: ${it.valorUnitario.toFixed(2)} ÷ ${meses} = ${novoUnit.toFixed(2)}`);
      }
      await tx.contrato.update({ where: { id: contrato.id }, data: { valoresMensaisConfirmadosEm: agora } });
    });
    resumo =
      `Valores dos itens eram da VIGÊNCIA; divididos pelos meses de cada vigência para virar mensais (${contrato.itens.length} item(ns)). ` +
      linhas.slice(0, 12).join("; ") +
      (linhas.length > 12 ? "; …" : "");
  }

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "Contrato",
    recursoId: contrato.id,
    resumo,
  }).catch(() => {});

  revalidatePath(`/contratos/${contrato.id}`);
  revalidatePath("/contratos");
  revalidatePath("/dashboard");
  return { ok: true };
}
