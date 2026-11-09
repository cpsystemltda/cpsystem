"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { registrarAuditoria } from "@/lib/auditoria";
import { CHAVE_FAIXAS, CHAVE_NOME_PACOTE, type Faixa } from "@/lib/faixasTerceirizacao";
import { CHAVE_COBRANCA_ATIVA } from "@/lib/faixasTerceirizacaoServer";

export type ResultadoFaixas = { ok?: boolean; erro?: string; mensagem?: string } | null;

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** ESP-011 RN02/RN09 — faixas, nome do pacote e a chave que liga a cobrança/avisos ao cliente. */
export async function salvarFaixasAction(_p: ResultadoFaixas, formData: FormData): Promise<ResultadoFaixas> {
  const usuario = await exigirUsuario();
  await bloquearEspionagem();
  if (!usuario.superAdmin) return { erro: "Só o gestor da plataforma altera as faixas." };

  const tetos = formData.getAll("ate").map(num);
  const valores = formData.getAll("valor").map(num);
  const faixas: Faixa[] = [];
  for (let i = 0; i < tetos.length; i++) {
    const ate = tetos[i];
    const valor = valores[i];
    if (ate == null && valor == null) continue;
    if (ate == null || ate < 1 || !Number.isInteger(ate)) return { erro: `Faixa ${i + 1}: informe o limite de colaboradores (número inteiro).` };
    if (valor == null || valor < 0) return { erro: `Faixa ${i + 1}: informe o valor (0 para incluída no plano).` };
    faixas.push({ ate, valor });
  }
  if (!faixas.length) return { erro: "Informe ao menos uma faixa." };
  faixas.sort((a, b) => (a.ate ?? 0) - (b.ate ?? 0));
  for (let i = 1; i < faixas.length; i++) if (faixas[i].ate === faixas[i - 1].ate) return { erro: `Dois limites iguais (${faixas[i].ate}).` };

  const nomePacote = String(formData.get("nomePacote") || "").trim().slice(0, 60);
  const cobrancaAtiva = formData.get("cobrancaAtiva") === "on";

  for (const [chave, valor] of [
    [CHAVE_FAIXAS, faixas],
    [CHAVE_NOME_PACOTE, nomePacote || "Premium Terceirização"],
    [CHAVE_COBRANCA_ATIVA, cobrancaAtiva],
  ] as const) {
    await prisma.parametroPlataforma.upsert({ where: { chave }, create: { chave, valor, atualizadoPorId: usuario.id }, update: { valor, atualizadoPorId: usuario.id } });
  }
  await registrarAuditoria({
    contaId: usuario.contaId,
    usuarioId: usuario.id,
    acao: "ATUALIZAR",
    recurso: "ParametroPlataforma",
    recursoId: CHAVE_FAIXAS,
    resumo: `Faixas de colaboradores: ${faixas.map((f) => `até ${f.ate} = R$ ${f.valor}`).join(" · ")} · pacote "${nomePacote}" · avisos/preço ao cliente ${cobrancaAtiva ? "LIGADOS" : "desligados"}`,
  });
  revalidatePath("/admin-plataforma/terceirizacao");
  return { ok: true, mensagem: cobrancaAtiva ? "Salvo. Clientes passam a ver a faixa e a receber os avisos." : "Salvo. Clientes continuam sem ver preço de faixa (só o admin vê a apuração)." };
}
