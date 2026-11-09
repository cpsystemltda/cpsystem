"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { bloqueioModulo } from "@/lib/faixasTerceirizacaoServer";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarArquivo } from "@/lib/uploads";
import { anexarArquivosDaIa } from "@/lib/anexosDaIa";
import { podeEditarDocumento, mensagemSemPermissao } from "@/lib/permissoes";
import { extrairPlanilhasCustos, type PlanilhaCustosExtraida } from "@/lib/extrairAta";
import { excelParaTexto, ehArquivoExcel, ehArquivoPdf } from "@/lib/planilhaExcel";
import { divergente, totalDasLinhas } from "@/lib/planilhaCustos";

// Mesmo tratamento das outras leituras por IA (iaExtracao.ts): avisa a
// equipe e traduz falta de crédito numa mensagem que diz o que fazer.
async function mensagemDeFalhaDaIa(err: unknown): Promise<string> {
  const { avisarFalhaDeIa, ehFalhaDeCredito, mensagemParaCliente } = await import("@/lib/falhaIa");
  await avisarFalhaDeIa("leitura de planilha de custos", err);
  if (ehFalhaDeCredito(err)) return mensagemParaCliente();
  return err instanceof Error ? err.message : "Erro ao ler a planilha.";
}

/**
 * ESP-003 (Igor 07/11/2026) — planilha de custos e formação de preços.
 *
 * Leitura: a pessoa manda o PDF da proposta (ou o Excel) na aba "Planilha
 * de custos" do contrato de mão de obra; a IA devolve UMA planilha por
 * função, e nada é gravado antes da tela de conferência (RN04). Os arquivos
 * vão para a aba Anexos, como em qualquer leitura por IA (Regina 07/11).
 */

export type LeituraPlanilhasResult =
  | { ok: true; dados: PlanilhaCustosExtraida[]; arquivos: { url: string; nome: string; tamanhoBytes?: number }[] }
  | { ok: false; erro: string };

const MAX_ARQUIVOS = 8;

export async function lerPlanilhasCustosAction(formData: FormData): Promise<LeituraPlanilhasResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const contratoId = String(formData.get("contratoId") || "").trim();
  const files = formData.getAll("pdf").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, erro: "Selecione ao menos um arquivo PDF ou Excel." };
  if (files.length > MAX_ARQUIVOS) return { ok: false, erro: `São no máximo ${MAX_ARQUIVOS} arquivos por leitura.` };

  const contrato = contratoId
    ? await prisma.contrato.findFirst({
        where: { id: contratoId, empresa: { contaId: usuario.contaId } },
        select: { id: true, criadoPorId: true },
      })
    : null;
  if (!contrato) return { ok: false, erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { ok: false, erro: mensagemSemPermissao(contrato) };

  const pdfs: File[] = [];
  const textosExcel: { nome: string; csv: string }[] = [];
  for (const f of files) {
    if (ehArquivoPdf(f)) pdfs.push(f);
    else if (ehArquivoExcel(f)) {
      try {
        const csv = excelParaTexto(await f.arrayBuffer());
        if (!csv) return { ok: false, erro: `A planilha "${f.name}" está vazia.` };
        textosExcel.push({ nome: f.name, csv });
      } catch {
        return { ok: false, erro: `Não consegui abrir "${f.name}". Salve como .xlsx e tente de novo.` };
      }
    } else return { ok: false, erro: `"${f.name}" não é PDF nem Excel.` };
  }

  try {
    const dados = await extrairPlanilhasCustos(pdfs, textosExcel);
    if (dados.length === 0) {
      return {
        ok: false,
        erro:
          "Não reconheci uma planilha de custos por função nesse arquivo. Se for uma planilha consolidada " +
          "(várias funções num total só), cadastre manualmente uma função por vez.",
      };
    }
    const arquivos: { url: string; nome: string; tamanhoBytes?: number }[] = [];
    for (const f of files) {
      try {
        const salvo = await salvarArquivo(f);
        arquivos.push({ url: salvo.url, nome: salvo.nome, tamanhoBytes: salvo.tamanhoBytes });
      } catch (e) {
        console.warn(`[lerPlanilhasCustosAction] falha ao persistir "${f.name}":`, e);
      }
    }
    if (arquivos.length > 0) {
      await anexarArquivosDaIa({ contratoId: contrato.id }, arquivos, "Planilha de custos", "lerPlanilhasCustosAction");
      revalidatePath(`/contratos/${contrato.id}`);
    }
    return { ok: true, dados, arquivos };
  } catch (err) {
    console.error("[lerPlanilhasCustosAction] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

// ─────────────────────────────────────────────
// Salvar (conferência confirmada ou cadastro manual — RN04/RN08)
// ─────────────────────────────────────────────

const linhaSchema = z.object({
  modulo: z.enum(["1", "2.1", "2.2", "2.3", "3", "4", "5", "6", "OUTROS"]),
  descricao: z.string().trim().min(1, "Descrição obrigatória").max(300),
  percentual: z.number().finite().nullable(),
  valor: z.number().finite(),
  aRevisar: z.boolean().optional(),
});

const salvarSchema = z.object({
  id: z.string().optional(),
  contratoId: z.string().min(1),
  contratoItemId: z.string().nullable(),
  funcao: z.string().trim().min(1, "Informe a função").max(200),
  dataEfeito: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de efeito inválida"),
  origem: z.enum(["PROPOSTA", "REPACTUACAO", "REAJUSTE", "MANUAL"]),
  origemRef: z.string().trim().max(200).nullable(),
  cct: z.string().trim().max(500).nullable(),
  justificativaDivergencia: z.string().trim().max(1000).nullable(),
  arquivoUrl: z.string().max(500).nullable(),
  linhas: z.array(linhaSchema).min(1, "A planilha precisa de ao menos uma linha").max(200),
});

export type SalvarPlanilhaInput = z.input<typeof salvarSchema>;
export type SalvarPlanilhaResult = { ok: true; id: string; versao: number } | { ok: false; erro: string };

export async function salvarPlanilhaCustosAction(input: SalvarPlanilhaInput): Promise<SalvarPlanilhaResult> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const v = parsed.data;

  const contrato = await prisma.contrato.findFirst({
    where: { id: v.contratoId, empresa: { contaId: usuario.contaId } },
    select: { id: true, criadoPorId: true, numero: true },
  });
  if (!contrato) return { ok: false, erro: "Contrato não encontrado." };
  if (!podeEditarDocumento(usuario, contrato)) return { ok: false, erro: mensagemSemPermissao(contrato) };

  let item: { id: string; descricao: string; valorUnitario: number } | null = null;
  if (v.contratoItemId) {
    item = await prisma.contratoItem.findFirst({
      where: { id: v.contratoItemId, contratoId: contrato.id },
      select: { id: true, descricao: true, valorUnitario: true },
    });
    if (!item) return { ok: false, erro: "A função escolhida não pertence a este contrato." };
  }

  const totalMensal = totalDasLinhas(v.linhas);
  // RN04: diferença > R$ 0,05 do valor mensal unitário do item pede justificativa.
  if (item && divergente(totalMensal, item.valorUnitario) && !v.justificativaDivergencia) {
    return { ok: false, erro: "O total da planilha difere do valor mensal do item. Informe a justificativa para salvar." };
  }
  const mapeamentoARevisar = v.linhas.some((l) => l.aRevisar || l.modulo === "OUTROS");
  const dataEfeito = new Date(`${v.dataEfeito}T12:00:00-03:00`);

  const linhasData = v.linhas.map((l, i) => ({
    modulo: l.modulo,
    ordem: i,
    descricao: l.descricao,
    percentual: l.percentual,
    valor: Math.round(l.valor * 100) / 100,
    aRevisar: !!l.aRevisar,
  }));

  const comum = {
    contratoItemId: item?.id ?? null,
    funcao: v.funcao,
    dataEfeito,
    origem: v.origem,
    origemRef: v.origemRef || null,
    cct: v.cct || null,
    totalMensal,
    justificativaDivergencia: item && divergente(totalMensal, item.valorUnitario) ? v.justificativaDivergencia : null,
    mapeamentoARevisar,
    arquivoUrl: v.arquivoUrl || null,
  };

  if (v.id) {
    // Edição da própria versão (corrigir uma conferência) — não cria versão nova.
    const atual = await prisma.planilhaCustos.findFirst({
      where: { id: v.id, contratoId: contrato.id },
      select: { id: true, versao: true },
    });
    if (!atual) return { ok: false, erro: "Planilha não encontrada." };
    await prisma.$transaction([
      prisma.planilhaCustosLinha.deleteMany({ where: { planilhaId: atual.id } }),
      prisma.planilhaCustos.update({
        where: { id: atual.id },
        data: { ...comum, linhas: { create: linhasData } },
      }),
    ]);
    await registrarAuditoria({
      contaId: usuario.contaId,
      usuarioId: usuario.id,
      acao: "ATUALIZAR",
      recurso: "PlanilhaCustos",
      recursoId: atual.id,
      resumo: `Planilha de custos "${v.funcao}" (versão ${atual.versao}) corrigida · total mensal R$ ${totalMensal.toFixed(2)}`,
    });
    revalidatePath(`/contratos/${contrato.id}`);
    return { ok: true, id: atual.id, versao: atual.versao };
  }

  // RN06: a versão conta por função — pelo item vinculado, ou pelo nome
  // quando ainda não há vínculo.
  const anterior = await prisma.planilhaCustos.findFirst({
    where: item ? { contratoId: contrato.id, contratoItemId: item.id } : { contratoId: contrato.id, contratoItemId: null, funcao: v.funcao },
    orderBy: { versao: "desc" },
    select: { versao: true },
  });
  const versao = (anterior?.versao ?? 0) + 1;

  const criada = await prisma.planilhaCustos.create({
    data: {
      contratoId: contrato.id,
      ...comum,
      versao,
      criadoPorId: usuario.id,
      linhas: { create: linhasData },
    },
    select: { id: true },
  });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "PlanilhaCustos",
    recursoId: criada.id,
    resumo: `Planilha de custos "${v.funcao}" versão ${versao} (${v.origem.toLowerCase()}) · total mensal R$ ${totalMensal.toFixed(2)}${item ? ` · item "${item.descricao}"` : ""}`,
  });
  revalidatePath(`/contratos/${contrato.id}`);
  return { ok: true, id: criada.id, versao };
}

export async function excluirPlanilhaCustosAction(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  {
    const bloqueio = await bloqueioModulo(usuario.contaId);
    if (bloqueio) return { erro: bloqueio } as never;
  }
  const planilha = await prisma.planilhaCustos.findFirst({
    where: { id, contrato: { empresa: { contaId: usuario.contaId } } },
    select: { id: true, funcao: true, versao: true, contrato: { select: { id: true, criadoPorId: true } } },
  });
  if (!planilha) return { ok: false, erro: "Planilha não encontrada." };
  if (!podeEditarDocumento(usuario, planilha.contrato)) return { ok: false, erro: mensagemSemPermissao(planilha.contrato) };
  await prisma.planilhaCustos.delete({ where: { id: planilha.id } });
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "PlanilhaCustos",
    recursoId: planilha.id,
    resumo: `Planilha de custos "${planilha.funcao}" versão ${planilha.versao} excluída`,
  });
  revalidatePath(`/contratos/${planilha.contrato.id}`);
  return { ok: true };
}
