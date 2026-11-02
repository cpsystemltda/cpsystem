"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import { temAcessoInterno } from "@/lib/acessoInterno";
import {
  registrarFollowUp, atualizarFollowUp, excluirFollowUp, CANAIS, RESULTADOS, type DadosFollowUp,
} from "@/lib/followUpClientes";
import type { CanalFollowUp, ResultadoFollowUp } from "@/generated/prisma/client";

/**
 * Registro, correção e exclusão de um contato de follow-up (Igor, 30/10/2026).
 *
 * Quem mexe aqui é a equipe do CP System; o cliente nunca vê esta tela. O
 * marco da cadência não vem do formulário — a lib decide pela idade do
 * cliente, para o registro não depender de ninguém lembrar "em que marco ele
 * estava".
 */
export type ResultadoRegistro = { ok?: true; marco?: number; erro?: string };

async function equipe() {
  const usuario = await exigirUsuario();
  if (!(await temAcessoInterno(usuario))) throw new Error("Sem acesso ao follow-up de clientes.");
  // Registro é escrita: não acontece durante a observação de um cliente.
  await bloquearEspionagem();
  return usuario;
}

function lerDados(formData: FormData): DadosFollowUp {
  const texto = (k: string) => String(formData.get(k) ?? "").trim();

  const resultado = texto("resultado") as ResultadoFollowUp;
  if (!RESULTADOS.includes(resultado)) throw new Error("Informe se conseguiu falar com a pessoa.");

  const canal = texto("canal") as CanalFollowUp;
  if (!CANAIS.includes(canal)) throw new Error("Informe por onde foi o contato.");

  let retornarEm: Date | null = null;
  const retorno = texto("retornarEm");
  if (retorno) {
    const d = new Date(`${retorno}T12:00:00`);
    if (Number.isNaN(d.getTime())) throw new Error("Data de retorno inválida.");
    retornarEm = d;
  }

  return {
    resultado,
    canal,
    contatoNome: texto("contatoNome") || null,
    resumo: texto("resumo"),
    orientacoes: texto("orientacoes") || null,
    feedback: texto("feedback") || null,
    retornarEm,
  };
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "Não consegui salvar. Tente de novo.";
}

export async function registrarFollowUpAction(
  _prev: ResultadoRegistro | null,
  formData: FormData,
): Promise<ResultadoRegistro> {
  try {
    const usuario = await equipe();
    const contaId = String(formData.get("contaId") ?? "").trim();
    if (!contaId) return { erro: "Cliente não informado." };
    const r = await registrarFollowUp({ contaId, ...lerDados(formData) }, { id: usuario.id, nome: usuario.nome });
    revalidatePath("/follow-up");
    return { ok: true, marco: r.marcoDias };
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

export async function atualizarFollowUpAction(
  _prev: ResultadoRegistro | null,
  formData: FormData,
): Promise<ResultadoRegistro> {
  try {
    const usuario = await equipe();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { erro: "Registro não informado." };
    await atualizarFollowUp(id, lerDados(formData), { id: usuario.id, nome: usuario.nome });
    revalidatePath("/follow-up");
    return { ok: true };
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

export async function excluirFollowUpAction(id: string): Promise<ResultadoRegistro> {
  try {
    await equipe();
    if (!id) return { erro: "Registro não informado." };
    await excluirFollowUp(id);
    revalidatePath("/follow-up");
    return { ok: true };
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}
