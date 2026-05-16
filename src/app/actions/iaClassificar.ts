"use server";

/**
 * IA classifica + extrai PDF em uma única passada.
 *
 * Fluxo: usuário anexa PDF "qualquer" → action identifica se é Ata,
 * Contrato, Empenho, Aditivo, Apostilamento, Garantia, Notificação ou
 * Procedimento → roteia pra extrair com o schema correspondente →
 * persiste PDF no Blob → retorna dados + tipo pra UI redirecionar.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { exigirUsuario } from "@/lib/auth";
import { salvarArquivo } from "@/lib/uploads";
import {
  extrairAtaDoPdf,
  extrairContratoDoPdf,
  extrairEmpenhoDoPdf,
  extrairAditivoDoPdf,
  extrairApostilamentoDoPdf,
  extrairGarantiaDoPdf,
  extrairProcedimentoDoPdf,
  type AtaExtraida,
  type ContratoExtraido,
  type EmpenhoExtraido,
  type AditivoExtraido,
  type ApostilamentoExtraido,
  type GarantiaExtraida,
  type ProcedimentoExtraido,
} from "@/lib/extrairAta";

export type TipoDocumento =
  | "ATA"
  | "CONTRATO"
  | "EMPENHO"
  | "ADITIVO"
  | "APOSTILAMENTO"
  | "GARANTIA"
  | "NOTIFICACAO"
  | "PROCEDIMENTO"
  | "DESCONHECIDO";

const ROTAS_FORM: Partial<Record<TipoDocumento, string>> = {
  ATA: "/contratacoes/nova/ata",
  CONTRATO: "/contratacoes/nova/contrato",
  EMPENHO: "/contratacoes/nova/empenho",
};

// Tipos que rota direta pra form existente (M9 v1 — 3 principais).
// Outros (aditivo/garantia/etc.) ficam pra próxima iteração — UX
// orienta o usuário a abrir a entidade-pai e anexar lá.
export type ProcessarResult =
  | {
      ok: true;
      tipo: TipoDocumento;
      confidence: number;
      racional: string;
      arquivoUrl?: string;
      arquivoNome?: string;
      dados?:
        | AtaExtraida
        | ContratoExtraido
        | EmpenhoExtraido
        | AditivoExtraido
        | ApostilamentoExtraido
        | GarantiaExtraida
        | ProcedimentoExtraido;
      demo: boolean;
      rotaForm: string | null;
    }
  | { ok: false; erro: string };

function modoDemo(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.trim() === "";
}

async function classificar(file: File): Promise<{
  tipo: TipoDocumento;
  confidence: number;
  racional: string;
  demo: boolean;
}> {
  if (modoDemo()) {
    return mockClassificacao(file.name);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const client = new Anthropic({ apiKey });
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const schema = {
    type: "object",
    properties: {
      tipo: {
        type: "string",
        enum: [
          "ATA",
          "CONTRATO",
          "EMPENHO",
          "ADITIVO",
          "APOSTILAMENTO",
          "GARANTIA",
          "NOTIFICACAO",
          "PROCEDIMENTO",
          "DESCONHECIDO",
        ],
      },
      confidence: { type: "number" },
      racional: { type: "string" },
    },
    required: ["tipo", "confidence", "racional"],
    additionalProperties: false,
  };

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: `Você é um analista jurídico de contratações públicas. Classifique o documento PDF em uma das categorias:

- ATA: Ata de Registro de Preços (ARP, Lei 14.133 art. 82+). Características: registra preços pra futuras contratações, lista órgão gerenciador + participantes, prazo de até 1 ano + 1 prorrogação, vincula fornecedor sem obrigar contratação imediata.
- CONTRATO: Contrato administrativo. Características: instrumento que vincula partes pra fornecimento/serviço específico, com vigência e valor definidos. Inclui "contrato administrativo nº", "instrumento contratual", contratante/contratada qualificadas.
- EMPENHO: Nota de Empenho (NE) ou ordem de fornecimento — autoriza despesa sobre crédito orçamentário (formato "20XXNE######").
- ADITIVO: Termo aditivo (alteração contratual — art. 124). Identificável pelo título "Termo Aditivo nº X ao Contrato nº Y".
- APOSTILAMENTO: Termo de apostilamento (alteração simples — art. 136). Título tipicamente "Apostilamento".
- GARANTIA: Apólice de seguro-garantia, fiança bancária, comprovante de caução.
- NOTIFICACAO: Notificação administrativa (antes de procedimento apuratório). Tipicamente cobrança, intimação ou alerta de órgão.
- PROCEDIMENTO: Procedimento administrativo apuratório (portaria de abertura, art. 158+).
- DESCONHECIDO: nenhum dos acima.

REGRAS:
- Use o título do documento como pista principal, mas confirme pelo conteúdo.
- Se o título diz "Contrato Administrativo nº X/Y firmado decorrente de Pregão..." é CONTRATO, NÃO ATA.
- Se um documento gerado a partir de uma ARP é firmado como contrato específico, classifique como CONTRATO.
- Confidence DEVE refletir o que você escolheu — se o racional explica que é OUTRO tipo, ESCOLHA esse outro tipo. Nunca devolva tipo X com racional que descreve tipo Y.

Retorne tipo (em que o documento se enquadra de fato), confidence (0-1) e racional curto (1 frase).`,
        cache_control: { type: "ephemeral" },
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output_config: { format: { type: "json_schema", schema } } as any,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: "Classifique este documento." },
        ],
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return { tipo: "DESCONHECIDO", confidence: 0, racional: "Modelo não retornou texto.", demo: false };
  }
  const parsed = JSON.parse(block.text) as {
    tipo: TipoDocumento;
    confidence: number;
    racional: string;
  };
  return { ...parsed, demo: false };
}

function mockClassificacao(filename: string): {
  tipo: TipoDocumento;
  confidence: number;
  racional: string;
  demo: boolean;
} {
  const lower = filename.toLowerCase();
  let tipo: TipoDocumento = "DESCONHECIDO";
  if (lower.includes("ata") || lower.includes("arp")) tipo = "ATA";
  else if (lower.includes("contrato")) tipo = "CONTRATO";
  else if (lower.includes("empenho") || lower.includes("ne")) tipo = "EMPENHO";
  else if (lower.includes("aditivo")) tipo = "ADITIVO";
  else if (lower.includes("apostilamento")) tipo = "APOSTILAMENTO";
  else if (lower.includes("garantia") || lower.includes("apolice") || lower.includes("fianca")) tipo = "GARANTIA";
  else if (lower.includes("notifica")) tipo = "NOTIFICACAO";
  else if (lower.includes("procedimento") || lower.includes("apuratório") || lower.includes("apuratorio") || lower.includes("portaria")) tipo = "PROCEDIMENTO";
  return {
    tipo,
    confidence: tipo === "DESCONHECIDO" ? 0.2 : 0.85,
    racional: `Classificação baseada no nome do arquivo (modo demo): ${tipo}.`,
    demo: true,
  };
}

/**
 * Classifica + extrai + persiste PDF, em uma única chamada.
 */
export async function processarPdfIaAction(formData: FormData): Promise<ProcessarResult> {
  await exigirUsuario();
  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Selecione um arquivo PDF." };

  try {
    const { tipo, confidence, racional, demo } = await classificar(file);

    // Documento que a IA não conseguiu identificar — orienta usuário a
    // escolher manualmente. Pra baixa confiança em um tipo SUPORTADO
    // (Ata/Contrato/Empenho), ainda retorna a rota — UI deixa o usuário
    // confirmar a classificação antes de avançar.
    if (tipo === "DESCONHECIDO") {
      let arquivoUrl: string | undefined;
      let arquivoNome: string | undefined;
      try {
        const salvo = await salvarArquivo(file);
        arquivoUrl = salvo.url;
        arquivoNome = salvo.nome;
      } catch (errSave) {
        console.warn("[processarPdfIaAction] falha persistir PDF:", errSave);
      }
      return {
        ok: true,
        tipo,
        confidence,
        racional,
        demo,
        arquivoUrl,
        arquivoNome,
        rotaForm: null,
      };
    }

    // Extrai conforme o tipo
    let dados:
      | AtaExtraida
      | ContratoExtraido
      | EmpenhoExtraido
      | AditivoExtraido
      | ApostilamentoExtraido
      | GarantiaExtraida
      | ProcedimentoExtraido
      | undefined;
    switch (tipo) {
      case "ATA":
        dados = await extrairAtaDoPdf(file);
        break;
      case "CONTRATO":
        dados = await extrairContratoDoPdf(file);
        break;
      case "EMPENHO":
        dados = await extrairEmpenhoDoPdf(file);
        break;
      case "ADITIVO":
        dados = await extrairAditivoDoPdf(file);
        break;
      case "APOSTILAMENTO":
        dados = await extrairApostilamentoDoPdf(file);
        break;
      case "GARANTIA":
        dados = await extrairGarantiaDoPdf(file);
        break;
      case "PROCEDIMENTO":
        dados = await extrairProcedimentoDoPdf(file);
        break;
      case "NOTIFICACAO":
        // Notificação não tem extrator dedicado ainda — passa só o PDF
        break;
    }

    // Persiste PDF
    let arquivoUrl: string | undefined;
    let arquivoNome: string | undefined;
    try {
      const salvo = await salvarArquivo(file);
      arquivoUrl = salvo.url;
      arquivoNome = salvo.nome;
    } catch (errSave) {
      console.warn("[processarPdfIaAction] falha persistir PDF:", errSave);
    }

    return {
      ok: true,
      tipo,
      confidence,
      racional,
      dados,
      demo,
      arquivoUrl,
      arquivoNome,
      rotaForm: ROTAS_FORM[tipo] ?? null,
    };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro ao processar PDF." };
  }
}
