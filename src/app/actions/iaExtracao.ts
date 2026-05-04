"use server";

import { exigirUsuario } from "@/lib/auth";
import {
  extrairAtaDoPdf,
  extrairContratoDoPdf,
  extrairEmpenhoDoPdf,
  type AtaExtraida,
  type ContratoExtraido,
  type EmpenhoExtraido,
} from "@/lib/extrairAta";

function modoDemo(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.trim() === "";
}

export type ExtracaoAtaResult =
  | { ok: true; dados: AtaExtraida; demo: boolean }
  | { ok: false; erro: string };
export type ExtracaoContratoResult =
  | { ok: true; dados: ContratoExtraido; demo: boolean }
  | { ok: false; erro: string };
export type ExtracaoEmpenhoResult =
  | { ok: true; dados: EmpenhoExtraido; demo: boolean }
  | { ok: false; erro: string };

// retro-compat
export type ExtracaoResult = ExtracaoAtaResult;

export async function extrairAtaPdfAction(formData: FormData): Promise<ExtracaoAtaResult> {
  await exigirUsuario();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairAtaDoPdf(file);
    return { ok: true, dados, demo: modoDemo() };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao extrair." };
  }
}

export async function extrairContratoPdfAction(formData: FormData): Promise<ExtracaoContratoResult> {
  await exigirUsuario();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairContratoDoPdf(file);
    return { ok: true, dados, demo: modoDemo() };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao extrair." };
  }
}

export async function extrairEmpenhoPdfAction(formData: FormData): Promise<ExtracaoEmpenhoResult> {
  await exigirUsuario();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairEmpenhoDoPdf(file);
    return { ok: true, dados, demo: modoDemo() };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao extrair." };
  }
}
