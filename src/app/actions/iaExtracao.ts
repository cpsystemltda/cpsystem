"use server";

import { exigirUsuario } from "@/lib/auth";
import {
  extrairAtaDoPdf,
  extrairContratoDoPdf,
  extrairEmpenhoDoPdf,
  extrairGarantiaDoPdf,
  type AtaExtraida,
  type ContratoExtraido,
  type EmpenhoExtraido,
  type GarantiaExtraida,
} from "@/lib/extrairAta";
import { salvarArquivo } from "@/lib/uploads";

function modoDemo(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.trim() === "";
}

// Após a extração da IA, o PDF é persistido no Vercel Blob. O form usa
// `arquivoUrl`/`nomeArquivo` como hidden inputs pra criar o registro Anexo
// vinculado ao recurso (Ata/Contrato/Empenho) quando o save acontece.
export type ExtracaoAtaResult =
  | {
      ok: true;
      dados: AtaExtraida;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };
export type ExtracaoContratoResult =
  | {
      ok: true;
      dados: ContratoExtraido;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };
export type ExtracaoEmpenhoResult =
  | {
      ok: true;
      dados: EmpenhoExtraido;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };

export type ExtracaoGarantiaResult =
  | {
      ok: true;
      dados: GarantiaExtraida;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };

// retro-compat
export type ExtracaoResult = ExtracaoAtaResult;

export async function extrairAtaPdfAction(formData: FormData): Promise<ExtracaoAtaResult> {
  await exigirUsuario();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairAtaDoPdf(file);
    // Persiste o PDF — em modo demo a IA não roda mas o PDF mesmo assim é
    // salvo, pra que o anexo apareça quando o usuário gravar a Ata.
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      // Falha no upload não bloqueia extração — usuário ainda pode revisar
      // os dados e salvar a Ata sem anexo automático.
      console.warn("[extrairAtaPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
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
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      console.warn("[extrairContratoPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
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
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      console.warn("[extrairEmpenhoPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao extrair." };
  }
}

/**
 * M5 — IA extrai dados de PDF de garantia (apólice, fiança, etc.) e
 * persiste o arquivo no Vercel Blob pra ser anexado ao registro Garantia
 * quando o usuário salvar o formulário.
 */
export async function extrairGarantiaPdfAction(formData: FormData): Promise<ExtracaoGarantiaResult> {
  await exigirUsuario();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairGarantiaDoPdf(file);
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      console.warn("[extrairGarantiaPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao extrair." };
  }
}
