"use server";

// NOTA: maxDuration nao pode ser exportado deste arquivo (server actions
// so aceitam exports de async functions). Timeout estendido configurado
// em vercel.json -> functions[].maxDuration=60.

import { exigirUsuario } from "@/lib/auth";
import { bloquearEspionagem } from "@/lib/espionagem";
import {
  extrairAtaDoPdf,
  extrairContratoDoPdf,
  extrairEmpenhoDoPdf,
  extrairGarantiaDoPdf,
  extrairAditivoDoPdf,
  extrairApostilamentoDoPdf,
  extrairProcedimentoDoPdf,
  type AtaExtraida,
  type ContratoExtraido,
  type EmpenhoExtraido,
  type GarantiaExtraida,
  type AditivoExtraido,
  type ApostilamentoExtraido,
  type ProcedimentoExtraido,
} from "@/lib/extrairAta";
import { salvarArquivo } from "@/lib/uploads";

function modoDemo(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.trim() === "";
}

// Após a extração da IA, cada PDF é persistido no Vercel Blob. O form guarda
// `arquivos[]` em hidden inputs e cria um registro Anexo por arquivo quando
// o save acontece. `arquivoUrl`/`nomeArquivo` (o primeiro da lista) continuam
// por compatibilidade com quem só lê um arquivo (prefill do painel).
export type ArquivoExtraido = { url: string; nome: string; tamanhoBytes?: number };

export type ExtracaoAtaResult =
  | {
      ok: true;
      dados: AtaExtraida;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
      arquivos?: ArquivoExtraido[];
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
      arquivos?: ArquivoExtraido[];
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
      arquivos?: ArquivoExtraido[];
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

export type ExtracaoAditivoResult =
  | {
      ok: true;
      dados: AditivoExtraido;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };

export type ExtracaoApostilamentoResult =
  | {
      ok: true;
      dados: ApostilamentoExtraido;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };

export type ExtracaoProcedimentoResult =
  | {
      ok: true;
      dados: ProcedimentoExtraido;
      demo: boolean;
      arquivoUrl?: string;
      nomeArquivo?: string;
      tamanhoBytes?: number;
    }
  | { ok: false; erro: string };

// retro-compat
export type ExtracaoResult = ExtracaoAtaResult;

/**
 * Todos os PDFs do campo `pdf` — um ou vários.
 *
 * Regina, 07/11/2026: a leitura de ata, contrato e execução aceita mais de
 * um arquivo (o instrumento + edital + termo de referência + ETP + proposta).
 * A IA lê o conjunto e preenche com mais precisão; cada arquivo é persistido
 * e vira Anexo quando o registro é salvo.
 */
function pdfsDoFormulario(formData: FormData): File[] {
  return formData.getAll("pdf").filter((f): f is File => f instanceof File && f.size > 0);
}

/**
 * Persiste todos — em modo demo a IA não roda, mas os PDFs mesmo assim são
 * salvos, pra que os anexos apareçam quando o usuário gravar. Falha no upload
 * de um arquivo não bloqueia a extração nem os outros: a pessoa ainda pode
 * revisar os dados e anexar depois pela aba.
 */
async function persistirTodos(files: File[], rotulo: string): Promise<ArquivoExtraido[]> {
  const salvos: ArquivoExtraido[] = [];
  for (const f of files) {
    try {
      const salvo = await salvarArquivo(f);
      salvos.push({ url: salvo.url, nome: salvo.nome, tamanhoBytes: salvo.tamanhoBytes });
    } catch (errSave) {
      console.warn(`[${rotulo}] falha ao persistir "${f.name}":`, errSave);
    }
  }
  return salvos;
}

export async function extrairAtaPdfAction(formData: FormData): Promise<ExtracaoAtaResult> {
  await exigirUsuario();
  await bloquearEspionagem();
  const files = pdfsDoFormulario(formData);
  if (files.length === 0) return { ok: false, erro: "Selecione ao menos um arquivo PDF." };
  try {
    const dados = await extrairAtaDoPdf(files);
    const arquivos = await persistirTodos(files, "extrairAtaPdfAction");
    const primeiro = arquivos[0];
    return {
      ok: true,
      dados,
      demo: modoDemo(),
      arquivoUrl: primeiro?.url,
      nomeArquivo: primeiro?.nome,
      tamanhoBytes: primeiro?.tamanhoBytes,
      arquivos,
    };
  } catch (err) {
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

export async function extrairContratoPdfAction(formData: FormData): Promise<ExtracaoContratoResult> {
  await exigirUsuario();
  await bloquearEspionagem();
  const files = pdfsDoFormulario(formData);
  if (files.length === 0) return { ok: false, erro: "Selecione ao menos um arquivo PDF." };
  try {
    const dados = await extrairContratoDoPdf(files);
    const arquivos = await persistirTodos(files, "extrairContratoPdfAction");
    const primeiro = arquivos[0];
    return {
      ok: true,
      dados,
      demo: modoDemo(),
      arquivoUrl: primeiro?.url,
      nomeArquivo: primeiro?.nome,
      tamanhoBytes: primeiro?.tamanhoBytes,
      arquivos,
    };
  } catch (err) {
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

export async function extrairEmpenhoPdfAction(formData: FormData): Promise<ExtracaoEmpenhoResult> {
  await exigirUsuario();
  await bloquearEspionagem();
  const files = pdfsDoFormulario(formData);
  if (files.length === 0) return { ok: false, erro: "Selecione ao menos um arquivo PDF." };
  try {
    const dados = await extrairEmpenhoDoPdf(files);
    const arquivos = await persistirTodos(files, "extrairEmpenhoPdfAction");
    const primeiro = arquivos[0];
    return {
      ok: true,
      dados,
      demo: modoDemo(),
      arquivoUrl: primeiro?.url,
      nomeArquivo: primeiro?.nome,
      tamanhoBytes: primeiro?.tamanhoBytes,
      arquivos,
    };
  } catch (err) {
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

/**
 * M5 — IA extrai dados de PDF de garantia (apólice, fiança, etc.) e
 * persiste o arquivo no Vercel Blob pra ser anexado ao registro Garantia
 * quando o usuário salvar o formulário.
 */
export async function extrairGarantiaPdfAction(formData: FormData): Promise<ExtracaoGarantiaResult> {
  await exigirUsuario();
  await bloquearEspionagem();
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
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

/**
 * M3 — IA extrai dados de Termo Aditivo e persiste o PDF no Vercel Blob
 * pra ser anexado ao registro quando o usuário salvar o formulário.
 */
export async function extrairAditivoPdfAction(formData: FormData): Promise<ExtracaoAditivoResult> {
  await exigirUsuario();
  await bloquearEspionagem();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairAditivoDoPdf(file);
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      console.warn("[extrairAditivoPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
  } catch (err) {
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

/**
 * M3 — IA extrai dados de Procedimento Apuratório (Lei 14.133 art. 157+).
 * Tipicamente uma Portaria de Abertura ou Notificação Inicial.
 */
export async function extrairProcedimentoPdfAction(formData: FormData): Promise<ExtracaoProcedimentoResult> {
  await exigirUsuario();
  await bloquearEspionagem();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairProcedimentoDoPdf(file);
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      console.warn("[extrairProcedimentoPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
  } catch (err) {
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

/**
 * M3 — IA extrai dados de Termo de Apostilamento (Lei 14.133 art. 136).
 */
export async function extrairApostilamentoPdfAction(formData: FormData): Promise<ExtracaoApostilamentoResult> {
  await exigirUsuario();
  await bloquearEspionagem();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };
  try {
    const dados = await extrairApostilamentoDoPdf(file);
    let arquivoUrl: string | undefined;
    let nomeArquivo: string | undefined;
    let tamanhoBytes: number | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      nomeArquivo = salvo.nome;
      tamanhoBytes = salvo.tamanhoBytes;
    } catch (errSave) {
      console.warn("[extrairApostilamentoPdfAction] falha ao persistir PDF:", errSave);
    }
    return { ok: true, dados, demo: modoDemo(), arquivoUrl, nomeArquivo, tamanhoBytes };
  } catch (err) {
    console.error("[extracao IA] falhou:", err);
    return { ok: false, erro: await mensagemDeFalhaDaIa(err) };
  }
}

/**
 * Mensagem de erro da leitura de PDF, em português de gente — e aviso pra
 * equipe no mesmo movimento.
 *
 * Regina 28/08, quando a API ficou sem crédito: "não deixe nada parar". Não dá
 * pra impedir a queda do fornecedor; dá pra impedir que ela seja silenciosa e
 * que o cliente leve na cara um erro técnico que não diz o que fazer.
 */
async function mensagemDeFalhaDaIa(err: unknown): Promise<string> {
  const { avisarFalhaDeIa, ehFalhaDeCredito, mensagemParaCliente } = await import("@/lib/falhaIa");
  await avisarFalhaDeIa("leitura de PDF", err);
  if (ehFalhaDeCredito(err)) return mensagemParaCliente();
  return err instanceof Error ? err.message : "Erro ao extrair.";
}
