import "server-only";
import Anthropic from "@anthropic-ai/sdk";

type ItemExtraido = {
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
};

type Procedimento =
  | "PREGAO_ELETRONICO"
  | "PREGAO_PRESENCIAL"
  | "CONCORRENCIA"
  | "DISPENSA"
  | "INEXIGIBILIDADE"
  | "TOMADA_PRECOS"
  | "CONVITE";

export type AtaExtraida = {
  numero: string;
  processoAdministrativo: string;
  procedimentoSelecao: Procedimento;
  numeroLicitacao: string | null;
  idAtaPncp: string | null;
  objeto: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string;
  orgaoEmail: string | null;
  orgaoTelefone: string | null;
  dataAssinatura: string;
  dataPublicacao: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  aceitaCarona: boolean;
  itens: ItemExtraido[];
};

export type ContratoExtraido = {
  numero: string;
  numeroNotaEmpenho: string | null;
  processoAdministrativo: string;
  procedimentoSelecao: Procedimento;
  numeroLicitacao: string | null;
  objeto: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string;
  orgaoEmail: string | null;
  orgaoTelefone: string | null;
  dataAssinatura: string;
  dataPublicacao: string | null;
  vigenciaInicio: string;
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  itens: ItemExtraido[];
};

export type EmpenhoExtraido = {
  numero: string;
  identificador: string | null;
  processoAdministrativo: string;
  procedimentoSelecao: Procedimento;
  numeroLicitacao: string | null;
  objeto: string;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEndereco: string;
  orgaoEmail: string | null;
  orgaoTelefone: string | null;
  dataEmissao: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  itens: ItemExtraido[];
};

const SYSTEM_PROMPT = `Você é um analista jurídico especializado em contratações públicas brasileiras (Lei 14.133/2021 e legado da 8.666/93). Sua tarefa é extrair dados estruturados de Atas de Registro de Preços a partir do PDF anexado.

REGRAS DE EXTRAÇÃO:
- Datas no formato ISO 8601 (YYYY-MM-DD).
- Valores numéricos sem formatação (ponto como separador decimal, sem milhar).
- CNPJ apenas dígitos (14 caracteres).
- Procedimento de seleção use exatamente um destes códigos: PREGAO_ELETRONICO, PREGAO_PRESENCIAL, CONCORRENCIA, DISPENSA, INEXIGIBILIDADE, TOMADA_PRECOS, CONVITE.
- Se um campo opcional não estiver presente no documento, retorne null (e não invente dados).
- Para itens, extraia TODOS os itens registrados na ata. Para cada item: descrição completa, unidade de medida, quantidade, marca (se especificada) e valor unitário em reais.
- aceitaCarona é true quando a ata permite adesão por outros órgãos (carona); false caso contrário.
- Se o PDF não for uma Ata de Registro de Preços, retorne erro explicando o que recebeu.

Retorne APENAS o JSON estruturado solicitado, sem comentários ou explicações.`;

export async function extrairAtaDoPdf(file: File): Promise<AtaExtraida> {
  if (file.type !== "application/pdf") {
    throw new Error(`Esperado PDF, recebido ${file.type || "tipo desconhecido"}.`);
  }
  if (file.size > 32 * 1024 * 1024) {
    throw new Error("PDF maior que 32 MB. Reduza o tamanho do arquivo.");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return mockAta(file.name);
  }

  const client = new Anthropic({ apiKey });
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            numero: { type: "string" },
            processoAdministrativo: { type: "string" },
            procedimentoSelecao: {
              type: "string",
              enum: [
                "PREGAO_ELETRONICO",
                "PREGAO_PRESENCIAL",
                "CONCORRENCIA",
                "DISPENSA",
                "INEXIGIBILIDADE",
                "TOMADA_PRECOS",
                "CONVITE",
              ],
            },
            numeroLicitacao: { type: ["string", "null"] },
            idAtaPncp: { type: ["string", "null"] },
            objeto: { type: "string" },
            orgaoNome: { type: "string" },
            orgaoCnpj: { type: "string" },
            orgaoEndereco: { type: "string" },
            orgaoEmail: { type: ["string", "null"] },
            orgaoTelefone: { type: ["string", "null"] },
            dataAssinatura: { type: "string", format: "date" },
            dataPublicacao: { type: ["string", "null"], format: "date" },
            vigenciaInicio: { type: "string", format: "date" },
            vigenciaFim: { type: "string", format: "date" },
            prazoEntregaDias: { type: ["integer", "null"] },
            prazoPagamentoDias: { type: ["integer", "null"] },
            aceitaCarona: { type: "boolean" },
            itens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  descricao: { type: "string" },
                  unidade: { type: "string" },
                  quantidade: { type: "number" },
                  marca: { type: ["string", "null"] },
                  valorUnitario: { type: "number" },
                },
                required: ["descricao", "unidade", "quantidade", "marca", "valorUnitario"],
                additionalProperties: false,
              },
            },
          },
          required: [
            "numero",
            "processoAdministrativo",
            "procedimentoSelecao",
            "numeroLicitacao",
            "idAtaPncp",
            "objeto",
            "orgaoNome",
            "orgaoCnpj",
            "orgaoEndereco",
            "orgaoEmail",
            "orgaoTelefone",
            "dataAssinatura",
            "dataPublicacao",
            "vigenciaInicio",
            "vigenciaFim",
            "prazoEntregaDias",
            "prazoPagamentoDias",
            "aceitaCarona",
            "itens",
          ],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extraia os dados desta Ata de Registro de Preços conforme o schema JSON.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Modelo não retornou conteúdo textual.");
  }

  try {
    const data = JSON.parse(textBlock.text);
    return data as AtaExtraida;
  } catch {
    throw new Error("Resposta do modelo não é JSON válido.");
  }
}

// ============================================================
// EXTRACTOR GENÉRICO + Contrato + Empenho
// ============================================================

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    descricao: { type: "string" },
    unidade: { type: "string" },
    quantidade: { type: "number" },
    marca: { type: ["string", "null"] },
    valorUnitario: { type: "number" },
  },
  required: ["descricao", "unidade", "quantidade", "marca", "valorUnitario"],
  additionalProperties: false,
} as const;

const PROCEDIMENTO_ENUM = [
  "PREGAO_ELETRONICO",
  "PREGAO_PRESENCIAL",
  "CONCORRENCIA",
  "DISPENSA",
  "INEXIGIBILIDADE",
  "TOMADA_PRECOS",
  "CONVITE",
] as const;

const SYSTEM_PROMPT_BASE = `Você é um analista jurídico especializado em contratações públicas brasileiras (Lei 14.133/2021 e legado da 8.666/93).

REGRAS DE EXTRAÇÃO:
- Datas no formato ISO 8601 (YYYY-MM-DD).
- Valores numéricos sem formatação (ponto como separador decimal, sem milhar).
- CNPJ apenas dígitos (14 caracteres).
- Procedimento de seleção use exatamente um destes códigos: PREGAO_ELETRONICO, PREGAO_PRESENCIAL, CONCORRENCIA, DISPENSA, INEXIGIBILIDADE, TOMADA_PRECOS, CONVITE.
- Se um campo opcional não estiver presente, retorne null (e não invente dados).
- Para itens, extraia TODOS os itens do documento. Para cada um: descrição completa, unidade de medida, quantidade, marca (se especificada) e valor unitário em reais.
- Retorne APENAS o JSON estruturado solicitado, sem comentários.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function chamarClaudeComPdf(file: File, schema: any, prompt: string) {
  if (file.type !== "application/pdf") throw new Error(`Esperado PDF, recebido ${file.type || "tipo desconhecido"}.`);
  if (file.size > 32 * 1024 * 1024) throw new Error("PDF maior que 32 MB. Reduza o tamanho do arquivo.");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("__MOCK_REQUIRED__"); // sinal pra função externa retornar mock
  }

  const client = new Anthropic({ apiKey });
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: [{ type: "text", text: SYSTEM_PROMPT_BASE, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Modelo não retornou conteúdo textual.");
  try {
    return JSON.parse(textBlock.text);
  } catch {
    throw new Error("Resposta do modelo não é JSON válido.");
  }
}

async function tentarOuMock<T>(fn: () => Promise<T>, mock: () => T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && err.message === "__MOCK_REQUIRED__") return mock();
    throw err;
  }
}

export async function extrairContratoDoPdf(file: File): Promise<ContratoExtraido> {
  const schema = {
    type: "object",
    properties: {
      numero: { type: "string" },
      numeroNotaEmpenho: { type: ["string", "null"] },
      processoAdministrativo: { type: "string" },
      procedimentoSelecao: { type: "string", enum: PROCEDIMENTO_ENUM },
      numeroLicitacao: { type: ["string", "null"] },
      objeto: { type: "string" },
      orgaoNome: { type: "string" },
      orgaoCnpj: { type: "string" },
      orgaoEndereco: { type: "string" },
      orgaoEmail: { type: ["string", "null"] },
      orgaoTelefone: { type: ["string", "null"] },
      dataAssinatura: { type: "string", format: "date" },
      dataPublicacao: { type: ["string", "null"], format: "date" },
      vigenciaInicio: { type: "string", format: "date" },
      vigenciaFim: { type: "string", format: "date" },
      prazoEntregaDias: { type: ["integer", "null"] },
      prazoPagamentoDias: { type: ["integer", "null"] },
      itens: { type: "array", items: ITEM_SCHEMA },
    },
    required: [
      "numero", "numeroNotaEmpenho", "processoAdministrativo", "procedimentoSelecao",
      "numeroLicitacao", "objeto", "orgaoNome", "orgaoCnpj", "orgaoEndereco",
      "orgaoEmail", "orgaoTelefone", "dataAssinatura", "dataPublicacao",
      "vigenciaInicio", "vigenciaFim", "prazoEntregaDias", "prazoPagamentoDias", "itens",
    ],
    additionalProperties: false,
  };
  return tentarOuMock<ContratoExtraido>(
    () =>
      chamarClaudeComPdf(
        file,
        schema,
        "Extraia os dados deste Contrato administrativo conforme o schema JSON.",
      ) as Promise<ContratoExtraido>,
    () => mockContrato(file.name),
  );
}

export async function extrairEmpenhoDoPdf(file: File): Promise<EmpenhoExtraido> {
  const schema = {
    type: "object",
    properties: {
      numero: { type: "string" },
      identificador: { type: ["string", "null"] },
      processoAdministrativo: { type: "string" },
      procedimentoSelecao: { type: "string", enum: PROCEDIMENTO_ENUM },
      numeroLicitacao: { type: ["string", "null"] },
      objeto: { type: "string" },
      orgaoNome: { type: "string" },
      orgaoCnpj: { type: "string" },
      orgaoEndereco: { type: "string" },
      orgaoEmail: { type: ["string", "null"] },
      orgaoTelefone: { type: ["string", "null"] },
      dataEmissao: { type: "string", format: "date" },
      vigenciaInicio: { type: "string", format: "date" },
      vigenciaFim: { type: "string", format: "date" },
      prazoEntregaDias: { type: ["integer", "null"] },
      prazoPagamentoDias: { type: ["integer", "null"] },
      itens: { type: "array", items: ITEM_SCHEMA },
    },
    required: [
      "numero", "identificador", "processoAdministrativo", "procedimentoSelecao",
      "numeroLicitacao", "objeto", "orgaoNome", "orgaoCnpj", "orgaoEndereco",
      "orgaoEmail", "orgaoTelefone", "dataEmissao", "vigenciaInicio", "vigenciaFim",
      "prazoEntregaDias", "prazoPagamentoDias", "itens",
    ],
    additionalProperties: false,
  };
  return tentarOuMock<EmpenhoExtraido>(
    () =>
      chamarClaudeComPdf(
        file,
        schema,
        "Extraia os dados desta Nota de Empenho conforme o schema JSON.",
      ) as Promise<EmpenhoExtraido>,
    () => mockEmpenho(file.name),
  );
}

// ============================================================
// MOCKS — usados quando ANTHROPIC_API_KEY não está configurada
// Permite testar o fluxo de extração sem chave real.
// Em produção, configure a chave no .env.
// ============================================================

function ano() {
  return new Date().getFullYear();
}

function dataIso(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function nomeBase(filename: string) {
  return filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
}

function mockAta(filename: string): AtaExtraida {
  return {
    numero: `42/${ano()}`,
    processoAdministrativo: `67610.012345/${ano()}-67`,
    procedimentoSelecao: "PREGAO_ELETRONICO",
    numeroLicitacao: `15/${ano()}`,
    idAtaPncp: `26988671000131-1-000015/${ano()}`,
    objeto: `[DEMO · ${nomeBase(filename)}] Aquisição de cartuchos de toner originais para impressoras Lexmark, conforme Termo de Referência anexo, em atendimento às demandas administrativas do órgão gerenciador e órgãos participantes.`,
    orgaoNome: "Comando do Exército Brasileiro",
    orgaoCnpj: "00394452000301",
    orgaoEndereco: "Quartel General do Exército, Bloco H, SMU, Brasília/DF",
    orgaoEmail: "licitacao@eb.mil.br",
    orgaoTelefone: "(61) 3415-4444",
    dataAssinatura: dataIso(-7),
    dataPublicacao: dataIso(-5),
    vigenciaInicio: dataIso(-5),
    vigenciaFim: dataIso(355),
    prazoEntregaDias: 30,
    prazoPagamentoDias: 30,
    aceitaCarona: true,
    itens: [
      {
        descricao: "Cartucho de toner Lexmark 50F4U00, original, 20.000 páginas",
        unidade: "UN",
        quantidade: 200,
        marca: "Lexmark",
        valorUnitario: 850.0,
      },
      {
        descricao: "Cartucho de toner Lexmark 60F4H00, original, 10.000 páginas",
        unidade: "UN",
        quantidade: 150,
        marca: "Lexmark",
        valorUnitario: 620.5,
      },
      {
        descricao: "Cilindro fotocondutor Lexmark 50F0Z00, original",
        unidade: "UN",
        quantidade: 50,
        marca: "Lexmark",
        valorUnitario: 480.0,
      },
    ],
  };
}

function mockContrato(filename: string): ContratoExtraido {
  return {
    numero: `${ano()}/0098`,
    numeroNotaEmpenho: `2025NE000456`,
    processoAdministrativo: `67610.067890/${ano()}-32`,
    procedimentoSelecao: "PREGAO_ELETRONICO",
    numeroLicitacao: `15/${ano()}`,
    objeto: `[DEMO · ${nomeBase(filename)}] Prestação de serviços continuados de manutenção predial preventiva e corretiva nas instalações do contratante.`,
    orgaoNome: "Polícia Militar do Distrito Federal",
    orgaoCnpj: "08923810000170",
    orgaoEndereco: "SAM Conjunto A, Bloco 1, Brasília/DF, CEP 70620-000",
    orgaoEmail: "compras@pmdf.df.gov.br",
    orgaoTelefone: "(61) 3190-5000",
    dataAssinatura: dataIso(-3),
    dataPublicacao: dataIso(-1),
    vigenciaInicio: dataIso(0),
    vigenciaFim: dataIso(365),
    prazoEntregaDias: null,
    prazoPagamentoDias: 30,
    itens: [
      {
        descricao: "Manutenção preventiva e corretiva de sistema elétrico predial — quadros, cabeamento e iluminação",
        unidade: "MES",
        quantidade: 12,
        marca: null,
        valorUnitario: 18500.0,
      },
      {
        descricao: "Manutenção preventiva e corretiva de sistema hidráulico predial",
        unidade: "MES",
        quantidade: 12,
        marca: null,
        valorUnitario: 12300.0,
      },
    ],
  };
}

function mockEmpenho(filename: string): EmpenhoExtraido {
  return {
    numero: `2025NE000789`,
    identificador: `1ª Solicitação`,
    processoAdministrativo: `67610.067890/${ano()}-32`,
    procedimentoSelecao: "PREGAO_ELETRONICO",
    numeroLicitacao: `15/${ano()}`,
    objeto: `[DEMO · ${nomeBase(filename)}] Aquisição de 50 (cinquenta) cartuchos de toner Lexmark 50F4U00 para o setor administrativo.`,
    orgaoNome: "Comando do Exército Brasileiro",
    orgaoCnpj: "00394452000301",
    orgaoEndereco: "Quartel General do Exército, Bloco H, SMU, Brasília/DF",
    orgaoEmail: "licitacao@eb.mil.br",
    orgaoTelefone: "(61) 3415-4444",
    dataEmissao: dataIso(-2),
    vigenciaInicio: dataIso(-2),
    vigenciaFim: dataIso(60),
    prazoEntregaDias: 30,
    prazoPagamentoDias: 30,
    itens: [
      {
        descricao: "Cartucho de toner Lexmark 50F4U00, original, 20.000 páginas",
        unidade: "UN",
        quantidade: 50,
        marca: "Lexmark",
        valorUnitario: 850.0,
      },
    ],
  };
}
