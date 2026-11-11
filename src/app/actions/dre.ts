"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { ehCategoria, somarMeses } from "@/lib/dreConstantes";

type Result = { ok?: boolean; erro?: string } | null;

const PAGINA = "/admin-plataforma/dre";

/** "1.234,56" → 1234.56; "1234.56" → 1234.56; "397" → 397. */
function lerValor(bruto: string): number | null {
  const s = bruto.trim().replace(/^R\$\s*/i, "");
  if (!s) return null;
  const normalizado = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Lança uma despesa da plataforma na competência informada — e, se pedido,
 * repete nos meses seguintes (assinaturas mensais: Vercel, Neon, Z-API...).
 * Só super admin; nunca em modo de acompanhamento.
 */
export async function lancarDespesaAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };
  await bloquearEspionagem();

  const competencia = String(formData.get("competencia") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim();
  const descricao = String(formData.get("descricao") || "").trim().slice(0, 120);
  const valor = lerValor(String(formData.get("valor") || ""));
  const repetir = Math.min(24, Math.max(0, Number(formData.get("repetir") || 0) || 0));

  if (!/^\d{4}-\d{2}$/.test(competencia)) return { erro: "Informe a competência no formato AAAA-MM." };
  if (!ehCategoria(categoria)) return { erro: "Escolha uma categoria." };
  if (!descricao) return { erro: "Descreva a despesa (ex.: Vercel Pro, Neon Launch)." };
  if (valor === null) return { erro: "Informe um valor maior que zero." };

  const competencias = Array.from({ length: repetir + 1 }, (_, i) => somarMeses(competencia, i));
  await prisma.despesaPlataforma.createMany({
    data: competencias.map((c) => ({ competencia: c, categoria, descricao, valor, criadoPorId: usuario.id })),
  });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "CRIAR",
    recurso: "DespesaPlataforma",
    resumo:
      `Despesa "${descricao}" (${categoria}) de R$ ${valor.toFixed(2)} lançada em ${competencia}` +
      (repetir ? ` e repetida por mais ${repetir} mês(es), até ${competencias[competencias.length - 1]}` : ""),
  }).catch(() => {});

  revalidatePath(PAGINA);
  return { ok: true };
}

export async function excluirDespesaAction(_p: Result, formData: FormData): Promise<Result> {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };
  await bloquearEspionagem();

  const id = String(formData.get("id") || "").trim();
  if (!id) return { erro: "Despesa não informada." };
  const d = await prisma.despesaPlataforma.findUnique({ where: { id } });
  if (!d) return { erro: "Despesa não encontrada." };
  await prisma.despesaPlataforma.delete({ where: { id } });

  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "EXCLUIR",
    recurso: "DespesaPlataforma",
    recursoId: id,
    resumo: `Despesa "${d.descricao}" de R$ ${d.valor.toFixed(2)} (${d.competencia}) excluída`,
  }).catch(() => {});

  revalidatePath(PAGINA);
  return { ok: true };
}

const CLASSES_SAIDA = ["INFRAESTRUTURA", "IA", "FERRAMENTAS", "MARKETING", "CONTABILIDADE", "IMPOSTOS", "PESSOAL", "OUTROS", "RETIRADA_SOCIO", "IGNORAR"] as const;

/** Troca a categoria de uma saída da conta Asaas no DRE (Regina 10/11/2026). */
export async function classificarSaidaAction(id: string, classe: string): Promise<Result> {
  const usuario = await exigirUsuario();
  if (!usuario.superAdmin) return { erro: "Apenas gestores da plataforma." };
  await bloquearEspionagem();
  if (!(CLASSES_SAIDA as readonly string[]).includes(classe)) return { erro: "Categoria inválida." };
  const chave = "dre.classificacaoSaidas";
  const atual = await prisma.parametroPlataforma.findUnique({ where: { chave } });
  const mapa = { ...((atual?.valor && typeof atual.valor === "object" ? atual.valor : {}) as Record<string, string>), [id]: classe };
  await prisma.parametroPlataforma.upsert({ where: { chave }, create: { chave, valor: mapa, atualizadoPorId: usuario.id }, update: { valor: mapa, atualizadoPorId: usuario.id } });
  await registrarAuditoria({ contaId: usuario.contaId, usuarioId: usuario.id, acao: "ATUALIZAR", recurso: "ParametroPlataforma", recursoId: chave, resumo: `Saída do Asaas ${id} classificada como ${classe}` });
  revalidatePath(PAGINA);
  return { ok: true };
}
