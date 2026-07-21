import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Extrator de extrato bancário via LLM (Claude Sonnet).
// Regina 21/07/2026: cliente sobe PDF do extrato (qualquer banco), LLM extrai
// transacoes estruturadas em JSON. Sem depender de layout especifico.

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type TransacaoExtraida = {
  data: string;          // ISO YYYY-MM-DD
  tipo: "CREDITO" | "DEBITO";
  valor: number;         // sempre positivo
  descricao: string;     // histórico bancário bruto
  nomeContraparte: string | null;
  cnpjContraparte: string | null;
  identificadorBancario: string | null;
};

export type MetadadosExtrato = {
  bancoDetectado: string | null;
  agenciaConta: string | null;
  periodoInicio: string | null; // ISO
  periodoFim: string | null;    // ISO
  saldoInicial: number | null;
  saldoFinal: number | null;
};

export type ExtracaoResultado = {
  meta: MetadadosExtrato;
  transacoes: TransacaoExtraida[];
};

const SCHEMA_INSTRUCTION = `Você é um extrator determinístico de extratos bancários brasileiros.

Receberá um PDF de extrato e deve devolver ESTRITAMENTE JSON no formato:

{
  "meta": {
    "bancoDetectado": string | null,      // ex: "Banco do Brasil", "Itaú", null se não identificar
    "agenciaConta": string | null,        // ex: "1234-5 / 67890-1"
    "periodoInicio": "YYYY-MM-DD" | null,
    "periodoFim":    "YYYY-MM-DD" | null,
    "saldoInicial":  number  | null,
    "saldoFinal":    number  | null
  },
  "transacoes": [
    {
      "data": "YYYY-MM-DD",
      "tipo": "CREDITO" | "DEBITO",
      "valor": number,                      // SEMPRE positivo, sinal no tipo
      "descricao": string,                  // histórico bancário completo, sem cortar
      "nomeContraparte": string | null,     // pagador (crédito) ou beneficiário (débito)
      "cnpjContraparte": string | null,     // CNPJ formatado 00.000.000/0000-00 se aparecer
      "identificadorBancario": string | null // nº lançamento / ID doc / referência
    }
  ]
}

Regras:
- Extraia TODAS as transações, sem pular nenhuma.
- Valores sempre positivos; o sinal (débito/crédito) vem no campo "tipo".
- Data sempre em ISO YYYY-MM-DD.
- Se o histórico mencionar "TED", "PIX RECEBIDO", "PIX ENVIADO", "OB" (ordem bancária), "TRANSFERÊNCIA", identifique como CREDITO ou DEBITO conforme a coluna do extrato.
- Se identificar CNPJ no histórico, extraia e formate como 00.000.000/0000-00.
- NÃO invente dados. Se um campo não estiver no extrato, retorne null.
- NÃO inclua saldos parciais como transação — apenas as linhas de movimento.
- Retorne APENAS o JSON, sem markdown, sem texto explicativo antes ou depois.`;

// Extrai transações + metadados de um PDF de extrato bancário.
// pdfBase64: PDF codificado em base64 (sem prefixo data:).
export async function extrairExtrato(pdfBase64: string): Promise<ExtracaoResultado> {
  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          {
            type: "text",
            text: SCHEMA_INSTRUCTION,
          },
        ],
      },
    ],
  });

  const bloco = resp.content.find((c) => c.type === "text");
  if (!bloco || bloco.type !== "text") {
    throw new Error("LLM não retornou texto");
  }
  // Remove code fences se vier
  const jsonStr = bloco.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: ExtracaoResultado;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Falha parse JSON do LLM: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!parsed.meta || !Array.isArray(parsed.transacoes)) {
    throw new Error("JSON do LLM não tem estrutura esperada (meta + transacoes[])");
  }
  return parsed;
}
