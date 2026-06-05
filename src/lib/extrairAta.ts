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

export type ModalidadeGarantiaExtraida =
  | "SEGURO_GARANTIA"
  | "FIANCA_BANCARIA"
  | "CAUCAO_DINHEIRO"
  | "TITULOS_DIVIDA_PUBLICA";

export type GarantiaExtraida = {
  modalidade: ModalidadeGarantiaExtraida;
  seguradora: string | null; // só pra SEGURO_GARANTIA
  banco: string | null;      // só pra FIANCA_BANCARIA
  valor: number;
  dataInicio: string;        // YYYY-MM-DD
  dataFim: string | null;
  descricao: string | null;  // detalhes adicionais (TÍTULOS DA DÍVIDA PÚBLICA)
};

export type TipoAlteracaoValorExtraida =
  | "ACRESCIMO"
  | "SUPRESSAO"
  | "REAJUSTE_REPACTUACAO"
  | "REEQUILIBRIO";

export type IndiceReajusteExtraido =
  | "IPCA"
  | "IPCA_E"
  | "IPCA_15"
  | "IGPM"
  | "INCC"
  | "INPC"
  | "IST"
  | "CONTRATUAL"
  | "OUTRO";

export type FinalidadeApostilamentoExtraida =
  | "REAJUSTE"
  | "APLICACAO_PENALIDADE"
  | "EMPENHO_CREDITO_SUPLEMENTAR"
  | "OUTROS";

export type ProcedimentoExtraido = {
  numero: string | null;
  notificacaoNumero: string | null;
  assunto: string;
  descricao: string;
  comissaoMembros: string[];
  autoridade: string | null;
  dataAbertura: string; // YYYY-MM-DD
};

export type ApostilamentoExtraido = {
  numero: string;
  objeto: string;
  dataAssinatura: string; // YYYY-MM-DD

  finalidade: FinalidadeApostilamentoExtraida | null;
  motivo: string | null;

  alteraValor: boolean;
  tipoAlteracaoValor: TipoAlteracaoValorExtraida | null;
  novoValor: number | null;

  alteraPrazoVigencia: boolean;
  novaVigenciaInicio: string | null;
  novaVigenciaFim: string | null;
  novaVigenciaPrazo: number | null;
  novaVigenciaUnidade: "DIAS" | "MESES" | "ANOS" | null;

  alteraPrazoEntrega: boolean;
  novoPrazoEntregaDias: number | null;
  novoPrazoEntregaUnidade: "DIAS" | "MESES" | "ANOS" | null;

  aplicaReajuste: boolean;
  reajusteIndice: IndiceReajusteExtraido | null;
  reajusteIndiceOutro: string | null;
  reajustePeriodoInicio: string | null;
  reajustePeriodoFim: string | null;
  reajustePercentual: number | null;

  observacoes: string | null;
};

export type ItemAditivoExtraido = {
  descricao: string;
  unidade: string;
  quantidade: number;
  marca: string | null;
  valorUnitario: number;
};

export type AditivoExtraido = {
  numero: string;
  objeto: string;
  dataAssinatura: string; // YYYY-MM-DD

  alteraValor: boolean;
  tipoAlteracaoValor: TipoAlteracaoValorExtraida | null;
  novoValor: number | null;

  alteraPrazoVigencia: boolean;
  novaVigenciaInicio: string | null;
  novaVigenciaFim: string | null;
  novaVigenciaPrazo: number | null;
  novaVigenciaUnidade: "DIAS" | "MESES" | "ANOS" | null;

  alteraPrazoEntrega: boolean;
  novoPrazoEntregaDias: number | null;
  novoPrazoEntregaUnidade: "DIAS" | "MESES" | "ANOS" | null;

  aplicaReajuste: boolean;
  reajusteIndice: IndiceReajusteExtraido | null;
  reajusteIndiceOutro: string | null;
  reajustePeriodoInicio: string | null;
  reajustePeriodoFim: string | null;
  reajustePercentual: number | null;

  // Itens da nova vigência. Quando o aditivo prorroga vigência E lista
  // explicitamente os quantitativos/valores da nova vigência (caso comum
  // em prorrogações com renovação de SLA/escopo), a IA extrai aqui.
  // null quando o aditivo não traz lista explícita — nesse caso, a nova
  // vigência é criada copiando os itens da vigência anterior.
  itensNovaVigencia: ItemAditivoExtraido[] | null;

  observacoes: string | null;
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

  // Igor (05/06): Ata com 132 itens em lotes nao extraia. Causa: o
  // max_tokens de 8192 era curto pro JSON com 132 itens (~130 tokens por
  // item = 17K+ tokens). O modelo cortava no meio do JSON e o JSON.parse
  // falhava com 'Resposta nao e JSON valido'. Subido pra 32000 (limite
  // do Haiku 4.5). Adicionalmente, detectamos stop_reason='max_tokens'
  // pra dar erro claro caso ainda assim nao caiba.
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 32000,
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

  // Stop_reason 'max_tokens' = JSON foi cortado no meio. Pula o
  // JSON.parse (que vai falhar) e da mensagem util ao usuario.
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "PDF excede a capacidade de extracao automatica em uma unica passada (muitos itens). " +
        "Cadastre os campos principais manualmente — depois adicione os itens em lote.",
    );
  }

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

  const inicio = Date.now();
  const tag = `[chamarClaudeComPdf ${file.name} ${(file.size / 1024).toFixed(0)}KB]`;
  console.log(`${tag} iniciando extracao`);

  const client = new Anthropic({ apiKey });
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      // Subido de 8192 -> 32000 (limite Haiku 4.5) pra suportar PDFs
      // com muitos itens (ex: Contrato 132 itens em lotes). Igor (05/06).
      max_tokens: 32000,
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

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "PDF excede a capacidade de extracao automatica em uma unica passada (muitos itens). " +
          "Cadastre os campos principais manualmente — depois adicione os itens em lote.",
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("Modelo não retornou conteúdo textual.");
    try {
      const parsed = JSON.parse(textBlock.text);
      console.log(`${tag} sucesso em ${Date.now() - inicio}ms`);
      return parsed;
    } catch {
      throw new Error("Resposta do modelo não é JSON válido.");
    }
  } catch (err) {
    // Loga stack + status code do SDK pra diagnosticar nos Vercel logs.
    const erroInfo: Record<string, unknown> = {
      duracaoMs: Date.now() - inicio,
      pdfSizeKB: (file.size / 1024).toFixed(0),
    };
    if (err instanceof Error) {
      erroInfo.message = err.message;
      erroInfo.stack = err.stack;
    } else {
      erroInfo.err = String(err);
    }
    // SDK do Anthropic anexa status code e body em propriedades nao-padronizadas
    if (err && typeof err === "object") {
      const anyErr = err as Record<string, unknown>;
      if ("status" in anyErr) erroInfo.status = anyErr.status;
      if ("error" in anyErr) erroInfo.bodyError = anyErr.error;
    }
    console.error(`${tag} FALHOU:`, erroInfo);
    throw err;
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

/**
 * Extrai dados de uma apólice/instrumento de garantia (seguro-garantia,
 * fiança bancária, recibo de caução em dinheiro, ou comprovante de
 * vinculação de títulos da dívida pública). M5 — Lei 14.133 art. 96.
 */
export async function extrairGarantiaDoPdf(file: File): Promise<GarantiaExtraida> {
  const schema = {
    type: "object",
    properties: {
      modalidade: {
        type: "string",
        enum: ["SEGURO_GARANTIA", "FIANCA_BANCARIA", "CAUCAO_DINHEIRO", "TITULOS_DIVIDA_PUBLICA"],
      },
      seguradora: { type: ["string", "null"] },
      banco: { type: ["string", "null"] },
      valor: { type: "number" },
      dataInicio: { type: "string", format: "date" },
      dataFim: { type: ["string", "null"], format: "date" },
      descricao: { type: ["string", "null"] },
    },
    required: ["modalidade", "seguradora", "banco", "valor", "dataInicio", "dataFim", "descricao"],
    additionalProperties: false,
  };
  return tentarOuMock<GarantiaExtraida>(
    () =>
      chamarClaudeComPdf(
        file,
        schema,
        "Extraia os dados do instrumento de garantia contratual deste PDF (apólice de seguro-garantia, carta de fiança bancária, recibo de caução ou vinculação de títulos públicos) conforme o schema JSON. Identifique a modalidade pelo cabeçalho do documento. Preencha `seguradora` apenas se SEGURO_GARANTIA; `banco` apenas se FIANCA_BANCARIA; em CAUCAO_DINHEIRO/TITULOS_DIVIDA_PUBLICA deixe ambos null. `descricao` resume detalhes (número da apólice, código do título, etc.).",
      ) as Promise<GarantiaExtraida>,
    () => mockGarantia(file.name),
  );
}

/**
 * M3 — IA extrai dados de Termo Aditivo. Classifica natureza da alteração
 * (acréscimo/supressão/reajuste/reequilíbrio), detecta reajuste por índice
 * (IPCA, IPCA-E, IPCA-15, INCC, IST, OUTRO) e identifica blocos de alteração
 * de prazo (vigência, entrega).
 */
export async function extrairAditivoDoPdf(file: File): Promise<AditivoExtraido> {
  const schema = {
    type: "object",
    properties: {
      numero: { type: "string" },
      objeto: { type: "string" },
      dataAssinatura: { type: "string", format: "date" },

      alteraValor: { type: "boolean" },
      tipoAlteracaoValor: {
        type: ["string", "null"],
        enum: ["ACRESCIMO", "SUPRESSAO", "REAJUSTE_REPACTUACAO", "REEQUILIBRIO", null],
      },
      novoValor: { type: ["number", "null"] },

      alteraPrazoVigencia: { type: "boolean" },
      novaVigenciaInicio: { type: ["string", "null"], format: "date" },
      novaVigenciaFim: { type: ["string", "null"], format: "date" },
      novaVigenciaPrazo: { type: ["integer", "null"] },
      novaVigenciaUnidade: { type: ["string", "null"], enum: ["DIAS", "MESES", null] },

      alteraPrazoEntrega: { type: "boolean" },
      novoPrazoEntregaDias: { type: ["integer", "null"] },
      novoPrazoEntregaUnidade: { type: ["string", "null"], enum: ["DIAS", "MESES", null] },

      aplicaReajuste: { type: "boolean" },
      reajusteIndice: {
        type: ["string", "null"],
        enum: ["IPCA", "IPCA_E", "IPCA_15", "IGPM", "INCC", "INPC", "IST", "CONTRATUAL", "OUTRO", null],
      },
      reajusteIndiceOutro: { type: ["string", "null"] },
      reajustePeriodoInicio: { type: ["string", "null"], format: "date" },
      reajustePeriodoFim: { type: ["string", "null"], format: "date" },
      reajustePercentual: { type: ["number", "null"] },

      itensNovaVigencia: {
        type: ["array", "null"],
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

      observacoes: { type: ["string", "null"] },
    },
    required: [
      "numero", "objeto", "dataAssinatura",
      "alteraValor", "tipoAlteracaoValor", "novoValor",
      "alteraPrazoVigencia", "novaVigenciaInicio", "novaVigenciaFim",
      "novaVigenciaPrazo", "novaVigenciaUnidade",
      "alteraPrazoEntrega", "novoPrazoEntregaDias", "novoPrazoEntregaUnidade",
      "aplicaReajuste", "reajusteIndice", "reajusteIndiceOutro",
      "reajustePeriodoInicio", "reajustePeriodoFim", "reajustePercentual",
      "itensNovaVigencia",
      "observacoes",
    ],
    additionalProperties: false,
  };
  return tentarOuMock<AditivoExtraido>(
    () =>
      chamarClaudeComPdf(
        file,
        schema,
        `Extraia os dados do Termo Aditivo contratual conforme o schema JSON. Diretrizes:

1) **alteraValor**: true se o aditivo modifica valor contratual. **tipoAlteracaoValor**:
   - ACRESCIMO: aumento de quantitativo (Lei 14.133 art. 125)
   - SUPRESSAO: redução de quantitativo (art. 125, §1º)
   - REAJUSTE_REPACTUACAO: aplicação de índice ou recomposição contratual
   - REEQUILIBRIO: recomposição do equilíbrio econômico-financeiro (art. 124, II, d)
   **novoValor**: o valor monetário do aditivo (delta positivo p/ acréscimo, negativo p/ supressão).

2) **alteraPrazoVigencia**: true se prorroga vigência. Preencha dataInicio/dataFim quando explícitos. Se o aditivo só informar prazo (ex.: "+12 meses"), preencha novaVigenciaPrazo + novaVigenciaUnidade.

3) **alteraPrazoEntrega**: true se altera prazo de entrega/execução. Preencha novoPrazoEntregaDias + novoPrazoEntregaUnidade.

4) **aplicaReajuste** (subset de alteraValor): true APENAS se o aditivo aplica índice de reajuste sobre itens. Identifique o índice (IPCA, IPCA-E, IPCA-15, INCC, IST...) e preencha período de apuração e percentual.

5) **itensNovaVigencia**: lista de itens da nova vigência APENAS quando o aditivo prorroga vigência E lista explicitamente os quantitativos/valores da nova vigência (comum em prorrogações de contratos contínuos com renovação de SLA/escopo, ou em supressões/acréscimos com nova tabela). Extraia descrição completa, unidade, quantidade, marca (se especificada) e valorUnitario em reais. Se o aditivo só prorroga prazo SEM trazer tabela nova, retorne null — o sistema replicará os itens da vigência anterior automaticamente.

Campos não aplicáveis vêm como null. Não invente dados — se não está no PDF, retorne null.`,
      ) as Promise<AditivoExtraido>,
    () => mockAditivo(file.name),
  );
}

function mockGarantia(filename: string): GarantiaExtraida {
  const lower = filename.toLowerCase();
  if (lower.includes("fianca") || lower.includes("fiança")) {
    return {
      modalidade: "FIANCA_BANCARIA",
      seguradora: null,
      banco: "Banco do Brasil",
      valor: 50000,
      dataInicio: dataIso(0),
      dataFim: dataIso(365),
      descricao: `Fiança bancária extraída de ${nomeBase(filename)}`,
    };
  }
  if (lower.includes("caucao") || lower.includes("caução")) {
    return {
      modalidade: "CAUCAO_DINHEIRO",
      seguradora: null,
      banco: null,
      valor: 25000,
      dataInicio: dataIso(0),
      dataFim: dataIso(365),
      descricao: `Caução em dinheiro extraída de ${nomeBase(filename)}`,
    };
  }
  return {
    modalidade: "SEGURO_GARANTIA",
    seguradora: "Pottencial Seguradora",
    banco: null,
    valor: 100000,
    dataInicio: dataIso(0),
    dataFim: dataIso(365),
    descricao: `Apólice extraída de ${nomeBase(filename)}`,
  };
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

/**
 * M3 — IA extrai dados de Apostilamento. Identifica a finalidade
 * (Reajuste, Penalidade, Empenho Suplementar, Outros), detecta blocos
 * de alteração (valor, vigência, entrega) e, quando reajuste, captura
 * índice/período/percentual.
 */
export async function extrairApostilamentoDoPdf(file: File): Promise<ApostilamentoExtraido> {
  const schema = {
    type: "object",
    properties: {
      numero: { type: "string" },
      objeto: { type: "string" },
      dataAssinatura: { type: "string", format: "date" },

      finalidade: {
        type: ["string", "null"],
        enum: ["REAJUSTE", "APLICACAO_PENALIDADE", "EMPENHO_CREDITO_SUPLEMENTAR", "OUTROS", null],
      },
      motivo: { type: ["string", "null"] },

      alteraValor: { type: "boolean" },
      tipoAlteracaoValor: {
        type: ["string", "null"],
        enum: ["ACRESCIMO", "SUPRESSAO", "REAJUSTE_REPACTUACAO", "REEQUILIBRIO", null],
      },
      novoValor: { type: ["number", "null"] },

      alteraPrazoVigencia: { type: "boolean" },
      novaVigenciaInicio: { type: ["string", "null"], format: "date" },
      novaVigenciaFim: { type: ["string", "null"], format: "date" },
      novaVigenciaPrazo: { type: ["integer", "null"] },
      novaVigenciaUnidade: { type: ["string", "null"], enum: ["DIAS", "MESES", null] },

      alteraPrazoEntrega: { type: "boolean" },
      novoPrazoEntregaDias: { type: ["integer", "null"] },
      novoPrazoEntregaUnidade: { type: ["string", "null"], enum: ["DIAS", "MESES", null] },

      aplicaReajuste: { type: "boolean" },
      reajusteIndice: {
        type: ["string", "null"],
        enum: ["IPCA", "IPCA_E", "IPCA_15", "IGPM", "INCC", "INPC", "IST", "CONTRATUAL", "OUTRO", null],
      },
      reajusteIndiceOutro: { type: ["string", "null"] },
      reajustePeriodoInicio: { type: ["string", "null"], format: "date" },
      reajustePeriodoFim: { type: ["string", "null"], format: "date" },
      reajustePercentual: { type: ["number", "null"] },

      observacoes: { type: ["string", "null"] },
    },
    required: [
      "numero", "objeto", "dataAssinatura",
      "finalidade", "motivo",
      "alteraValor", "tipoAlteracaoValor", "novoValor",
      "alteraPrazoVigencia", "novaVigenciaInicio", "novaVigenciaFim",
      "novaVigenciaPrazo", "novaVigenciaUnidade",
      "alteraPrazoEntrega", "novoPrazoEntregaDias", "novoPrazoEntregaUnidade",
      "aplicaReajuste", "reajusteIndice", "reajusteIndiceOutro",
      "reajustePeriodoInicio", "reajustePeriodoFim", "reajustePercentual",
      "observacoes",
    ],
    additionalProperties: false,
  };
  return tentarOuMock<ApostilamentoExtraido>(
    () =>
      chamarClaudeComPdf(
        file,
        schema,
        `Extraia os dados do Termo de Apostilamento contratual (Lei 14.133 art. 136) conforme o schema JSON. Diretrizes:

1) **finalidade**: identifique a natureza do apostilamento:
   - REAJUSTE: aplicação de índice de reajuste (IPCA, INCC, IST...)
   - APLICACAO_PENALIDADE: registro de penalidade administrativa
   - EMPENHO_CREDITO_SUPLEMENTAR: alteração de dotação orçamentária / empenho suplementar
   - OUTROS: qualquer outra alteração simples (mudança de fonte, conta, etc.)

2) **motivo**: campo textual livre — descrição curta do que motivou o apostilamento (ex.: "Variação acumulada do IPCA no período 12 meses").

3) **alteraValor / tipoAlteracaoValor / novoValor**: idem aditivo (raramente usado em apostilamento — apostilamentos típicos não criam alteração quantitativa).

4) **alteraPrazoVigencia / alteraPrazoEntrega**: idem aditivo.

5) **aplicaReajuste**: true quando finalidade=REAJUSTE. Capture índice, período de apuração e percentual.

Campos não aplicáveis vêm como null. Não invente dados.`,
      ) as Promise<ApostilamentoExtraido>,
    () => mockApostilamento(file.name),
  );
}

/**
 * M3 — IA extrai dados de Procedimento Apuratório (Lei 14.133 art. 157+).
 * Tipicamente parseia uma Portaria de Abertura de Procedimento ou
 * Notificação Inicial — extrai número, comissão, autoridade competente,
 * data e descrição.
 */
export async function extrairProcedimentoDoPdf(file: File): Promise<ProcedimentoExtraido> {
  const schema = {
    type: "object",
    properties: {
      numero: { type: ["string", "null"] },
      notificacaoNumero: { type: ["string", "null"] },
      assunto: { type: "string" },
      descricao: { type: "string" },
      comissaoMembros: { type: "array", items: { type: "string" } },
      autoridade: { type: ["string", "null"] },
      dataAbertura: { type: "string", format: "date" },
    },
    required: [
      "numero", "notificacaoNumero", "assunto", "descricao",
      "comissaoMembros", "autoridade", "dataAbertura",
    ],
    additionalProperties: false,
  };
  return tentarOuMock<ProcedimentoExtraido>(
    () =>
      chamarClaudeComPdf(
        file,
        schema,
        `Extraia os dados de um Procedimento Apuratório (Lei 14.133/2021 art. 157+) conforme o schema JSON. Tipicamente o PDF é uma Portaria de Abertura, Notificação Inicial ou Termo de Instauração. Diretrizes:

1) **numero**: número do procedimento se atribuído (ex.: "PA 042/2026"). Se ainda não houver, null.
2) **notificacaoNumero**: número da notificação prévia que originou o procedimento (se houver). null se não mencionado.
3) **assunto**: descrição curta da irregularidade (ex.: "Atraso na entrega do empenho 2025NE000123").
4) **descricao**: descrição expandida com fatos relatados.
5) **comissaoMembros**: array com nomes dos servidores da comissão processante (mínimo 2 — Lei 14.133 exige composição). Cada item é o nome completo do servidor.
6) **autoridade**: autoridade competente para aplicar (ou não) a sanção (ex.: "Secretário de Administração").
7) **dataAbertura**: data de abertura/instauração do procedimento (YYYY-MM-DD).

Não invente dados. Se não está no PDF, retorne null/lista vazia.`,
      ) as Promise<ProcedimentoExtraido>,
    () => mockProcedimento(file.name),
  );
}

function mockProcedimento(filename: string): ProcedimentoExtraido {
  return {
    numero: `PA-${ano()}/0042`,
    notificacaoNumero: `NOT-${ano()}/0117`,
    assunto: `[DEMO · ${nomeBase(filename)}] Inadimplência na entrega do objeto contratado`,
    descricao:
      "Procedimento administrativo apuratório instaurado em razão de atraso na entrega dos itens 01 e 03 do empenho 2025NE000456, conforme apontado no relatório técnico de fiscalização nº 87/2026.",
    comissaoMembros: ["Maria Helena Souza (mat. 12345)", "João Pedro Vieira (mat. 67890)"],
    autoridade: "Secretário de Administração",
    dataAbertura: dataIso(-2),
  };
}

function mockApostilamento(filename: string): ApostilamentoExtraido {
  const lower = filename.toLowerCase();
  if (lower.includes("penalidade") || lower.includes("multa")) {
    return {
      numero: `01/${ano()}`,
      objeto: `[DEMO · ${nomeBase(filename)}] Registro de penalidade administrativa aplicada à contratada.`,
      dataAssinatura: dataIso(0),
      finalidade: "APLICACAO_PENALIDADE",
      motivo: "Atraso na entrega — multa moratória de 0,5% por dia.",
      alteraValor: false,
      tipoAlteracaoValor: null,
      novoValor: null,
      alteraPrazoVigencia: false,
      novaVigenciaInicio: null,
      novaVigenciaFim: null,
      novaVigenciaPrazo: null,
      novaVigenciaUnidade: null,
      alteraPrazoEntrega: false,
      novoPrazoEntregaDias: null,
      novoPrazoEntregaUnidade: null,
      aplicaReajuste: false,
      reajusteIndice: null,
      reajusteIndiceOutro: null,
      reajustePeriodoInicio: null,
      reajustePeriodoFim: null,
      reajustePercentual: null,
      observacoes: "Penalidade registrada por apostilamento conforme art. 136 da Lei 14.133.",
    };
  }
  if (lower.includes("empenho") || lower.includes("suplementar") || lower.includes("dotacao") || lower.includes("dotação")) {
    return {
      numero: `01/${ano()}`,
      objeto: `[DEMO · ${nomeBase(filename)}] Empenho de crédito suplementar — atualização da dotação orçamentária.`,
      dataAssinatura: dataIso(0),
      finalidade: "EMPENHO_CREDITO_SUPLEMENTAR",
      motivo: "Reforço de empenho para fazer face às obrigações do exercício.",
      alteraValor: false,
      tipoAlteracaoValor: null,
      novoValor: null,
      alteraPrazoVigencia: false,
      novaVigenciaInicio: null,
      novaVigenciaFim: null,
      novaVigenciaPrazo: null,
      novaVigenciaUnidade: null,
      alteraPrazoEntrega: false,
      novoPrazoEntregaDias: null,
      novoPrazoEntregaUnidade: null,
      aplicaReajuste: false,
      reajusteIndice: null,
      reajusteIndiceOutro: null,
      reajustePeriodoInicio: null,
      reajustePeriodoFim: null,
      reajustePercentual: null,
      observacoes: null,
    };
  }
  // Padrão: reajuste por IPCA
  return {
    numero: `01/${ano()}`,
    objeto: `[DEMO · ${nomeBase(filename)}] Apostilamento de reajuste pela variação acumulada do IPCA-IBGE.`,
    dataAssinatura: dataIso(0),
    finalidade: "REAJUSTE",
    motivo: "Aplicação do índice contratual IPCA — variação acumulada de 12 meses.",
    alteraValor: true,
    tipoAlteracaoValor: "REAJUSTE_REPACTUACAO",
    novoValor: null,
    alteraPrazoVigencia: false,
    novaVigenciaInicio: null,
    novaVigenciaFim: null,
    novaVigenciaPrazo: null,
    novaVigenciaUnidade: null,
    alteraPrazoEntrega: false,
    novoPrazoEntregaDias: null,
    novoPrazoEntregaUnidade: null,
    aplicaReajuste: true,
    reajusteIndice: "IPCA",
    reajusteIndiceOutro: null,
    reajustePeriodoInicio: dataIso(-365),
    reajustePeriodoFim: dataIso(0),
    reajustePercentual: 4.85,
    observacoes: null,
  };
}

function mockAditivo(filename: string): AditivoExtraido {
  const lower = filename.toLowerCase();
  // Heurística pra demo: o nome do PDF guia o tipo de aditivo simulado.
  if (lower.includes("reajuste") || lower.includes("ipca")) {
    return {
      numero: `01/${ano()}`,
      objeto: `[DEMO · ${nomeBase(filename)}] Reajuste contratual pela variação acumulada do IPCA no período de 12 meses.`,
      dataAssinatura: dataIso(0),
      alteraValor: true,
      tipoAlteracaoValor: "REAJUSTE_REPACTUACAO",
      novoValor: null,
      alteraPrazoVigencia: false,
      novaVigenciaInicio: null,
      novaVigenciaFim: null,
      novaVigenciaPrazo: null,
      novaVigenciaUnidade: null,
      alteraPrazoEntrega: false,
      novoPrazoEntregaDias: null,
      novoPrazoEntregaUnidade: null,
      aplicaReajuste: true,
      reajusteIndice: "IPCA",
      reajusteIndiceOutro: null,
      reajustePeriodoInicio: dataIso(-365),
      reajustePeriodoFim: dataIso(0),
      reajustePercentual: 4.85,
      itensNovaVigencia: null,
      observacoes: "Reajuste calculado pela variação acumulada do IPCA-IBGE no período de 12 meses.",
    };
  }
  if (lower.includes("prorroga") || lower.includes("vigencia") || lower.includes("vigência")) {
    return {
      numero: `01/${ano()}`,
      objeto: `[DEMO · ${nomeBase(filename)}] Prorrogação da vigência contratual por mais 12 meses.`,
      dataAssinatura: dataIso(0),
      alteraValor: false,
      tipoAlteracaoValor: null,
      novoValor: null,
      alteraPrazoVigencia: true,
      novaVigenciaInicio: dataIso(0),
      novaVigenciaFim: dataIso(365),
      novaVigenciaPrazo: 12,
      novaVigenciaUnidade: "MESES",
      alteraPrazoEntrega: false,
      novoPrazoEntregaDias: null,
      novoPrazoEntregaUnidade: null,
      aplicaReajuste: false,
      reajusteIndice: null,
      reajusteIndiceOutro: null,
      reajustePeriodoInicio: null,
      reajustePeriodoFim: null,
      reajustePercentual: null,
      itensNovaVigencia: null,
      observacoes: "Prorrogação por interesse da administração.",
    };
  }
  // Padrão: acréscimo quantitativo
  return {
    numero: `01/${ano()}`,
    objeto: `[DEMO · ${nomeBase(filename)}] Acréscimo quantitativo de 15% sobre o valor inicial do contrato (Lei 14.133 art. 125).`,
    dataAssinatura: dataIso(0),
    alteraValor: true,
    tipoAlteracaoValor: "ACRESCIMO",
    novoValor: 1675.35,
    alteraPrazoVigencia: false,
    novaVigenciaInicio: null,
    novaVigenciaFim: null,
    novaVigenciaPrazo: null,
    novaVigenciaUnidade: null,
    alteraPrazoEntrega: false,
    novoPrazoEntregaDias: null,
    novoPrazoEntregaUnidade: null,
    aplicaReajuste: false,
    reajusteIndice: null,
    reajusteIndiceOutro: null,
    reajustePeriodoInicio: null,
    reajustePeriodoFim: null,
    reajustePercentual: null,
    itensNovaVigencia: null,
    observacoes: "Acréscimo dentro do limite de 25% previsto em lei.",
  };
}
