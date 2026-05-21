import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type AnaliseJuridica = {
  resumoExecutivo: string;
  pontosCriticos: { titulo: string; descricao: string; severidade: "alta" | "media" | "baixa" }[];
  checklistGestao: { item: string; concluido: boolean }[];
  janelasCriticas: { evento: string; prazo: string; recomendacao: string }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SCHEMA: any = {
  type: "object",
  properties: {
    resumoExecutivo: { type: "string" },
    pontosCriticos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string" },
          severidade: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["titulo", "descricao", "severidade"],
        additionalProperties: false,
      },
    },
    checklistGestao: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          concluido: { type: "boolean" },
        },
        required: ["item", "concluido"],
        additionalProperties: false,
      },
    },
    janelasCriticas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          evento: { type: "string" },
          prazo: { type: "string" },
          recomendacao: { type: "string" },
        },
        required: ["evento", "prazo", "recomendacao"],
        additionalProperties: false,
      },
    },
  },
  required: ["resumoExecutivo", "pontosCriticos", "checklistGestao", "janelasCriticas"],
  additionalProperties: false,
};

const SYSTEM = `Você é um especialista em Direito Administrativo brasileiro com profundo domínio da Lei 14.133/2021 (Nova Lei de Licitações).
Analisa instrumentos contratuais — Atas de Registro de Preços, Contratos Administrativos, Empenhos (NE/AE/OS/AC/Carta-Contrato) e Termos de Cooperação — da perspectiva da empresa fornecedora (que vende para o governo) e entrega:
1. Resumo executivo claro (até 4 linhas).
2. Pontos críticos para defesa estratégica (cláusulas/riscos que podem ser explorados pela Administração contra a empresa).
3. Checklist de gestão (o que a empresa precisa fazer para cumprir sem ser penalizada).
4. Janelas críticas de prazo (eventos com data fixa que disparam consequência legal — vigência, reajuste, garantia, marco de prazo, etc.).
Seja específica, jurídica, prática. Cite artigos da Lei 14.133/2021 quando aplicável. Considere o tipo do documento (ARP tem regras de carona/limite, Empenho tem fluxo de execução, etc.).`;

export type TipoDocJuridico = "ATA" | "CONTRATO" | "EMPENHO" | "TERMO_COOPERACAO";

export type DocumentoEntrada = {
  tipo: TipoDocJuridico;
  numero: string;
  subTipo?: string; // ex: "FORNECIMENTO", "NOTA_EMPENHO"
  procedimentoSelecao?: string | null;
  orgaoNome: string;
  objeto: string;
  dataAssinatura?: Date | null;
  dataEmissao?: Date | null;
  dataPublicacao?: Date | null;
  vigenciaInicio?: Date | null;
  vigenciaFim?: Date | null;
  prazoEntregaDias?: number | null;
  prazoPagamentoDias?: number | null;
  marcoOrcamentoEstimado?: Date | null;
  marcoReajusteOrigem?: string | null;
  aceitaCarona?: boolean;
  status?: string;
  itens: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
  // Contexto extra: ata-pai do contrato, contrato-pai do empenho, etc.
  contextoAdicional?: string;
};

// Wrapper de compat — assinatura antiga (Contrato com schema interno).
type ContratoEntrada = {
  numero: string;
  tipo: string;
  procedimentoSelecao: string;
  orgaoNome: string;
  objeto: string;
  dataAssinatura: Date;
  vigenciaInicio: Date;
  vigenciaFim: Date;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  modalidadeEntrega: string;
  marcoInicialPrazo: string | null;
  itens: { descricao: string; quantidade: number; valorUnitario: number; valorTotal: number }[];
};

const ROTULO_TIPO: Record<TipoDocJuridico, string> = {
  ATA: "ATA DE REGISTRO DE PREÇOS",
  CONTRATO: "CONTRATO ADMINISTRATIVO",
  EMPENHO: "EMPENHO/INSTRUMENTO CONTRATUAL (art. 95)",
  TERMO_COOPERACAO: "TERMO DE COOPERAÇÃO",
};

// Análise generalizada — aceita Ata, Contrato, Empenho ou Termo de Cooperação.
// Retorna AnaliseJuridica estruturada (resumo, pontos críticos, checklist,
// janelas críticas). Usa claude-sonnet-4-6 (parecer técnico merece o modelo
// mais capaz) com prompt caching no system.
export async function analisarDocumentoIA(doc: DocumentoEntrada): Promise<AnaliseJuridica> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return analiseMockGenerico(doc);
  }

  const valorTotal = doc.itens.reduce((s, i) => s + i.valorTotal, 0);
  const linhas: string[] = [
    `Analise este ${ROTULO_TIPO[doc.tipo]} da perspectiva da empresa fornecedora.`,
    "",
    `Tipo: ${ROTULO_TIPO[doc.tipo]}${doc.subTipo ? ` · ${doc.subTipo}` : ""}`,
    `Número: ${doc.numero}`,
    `Órgão: ${doc.orgaoNome}`,
    `Objeto: ${doc.objeto}`,
  ];
  if (doc.procedimentoSelecao) linhas.push(`Procedimento de seleção: ${doc.procedimentoSelecao}`);
  if (doc.dataAssinatura) linhas.push(`Data de assinatura: ${doc.dataAssinatura.toLocaleDateString("pt-BR")}`);
  if (doc.dataEmissao) linhas.push(`Data de emissão/recebimento: ${doc.dataEmissao.toLocaleDateString("pt-BR")}`);
  if (doc.dataPublicacao) linhas.push(`Data de publicação: ${doc.dataPublicacao.toLocaleDateString("pt-BR")}`);
  if (doc.vigenciaInicio && doc.vigenciaFim) {
    linhas.push(`Vigência: ${doc.vigenciaInicio.toLocaleDateString("pt-BR")} → ${doc.vigenciaFim.toLocaleDateString("pt-BR")}`);
  }
  if (doc.prazoEntregaDias != null) linhas.push(`Prazo de entrega: ${doc.prazoEntregaDias} dias`);
  if (doc.prazoPagamentoDias != null) linhas.push(`Prazo de pagamento: ${doc.prazoPagamentoDias} dias`);
  if (doc.marcoOrcamentoEstimado) {
    linhas.push(`Marco para reajuste: ${doc.marcoOrcamentoEstimado.toLocaleDateString("pt-BR")}${doc.marcoReajusteOrigem ? ` (origem: ${doc.marcoReajusteOrigem})` : ""}`);
  }
  if (doc.aceitaCarona !== undefined) linhas.push(`Aceita carona: ${doc.aceitaCarona ? "Sim" : "Não"}`);
  if (doc.status) linhas.push(`Status atual: ${doc.status}`);
  linhas.push(
    "",
    `Valor total: R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `Itens: ${doc.itens.length} item(ns)`,
  );
  if (doc.contextoAdicional) {
    linhas.push("", "Contexto adicional:", doc.contextoAdicional);
  }
  linhas.push("", "Entregue a análise estruturada conforme schema.");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: linhas.join("\n") }],
  });

  const block = response.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") throw new Error("Resposta vazia da IA.");
  return JSON.parse(block.text) as AnaliseJuridica;
}

function analiseMockGenerico(doc: DocumentoEntrada): AnaliseJuridica {
  const valor = doc.itens.reduce((s, i) => s + i.valorTotal, 0);
  return {
    resumoExecutivo: `[MODO DEMO] ${ROTULO_TIPO[doc.tipo]} ${doc.numero} — ${doc.objeto.slice(0, 100)}. Valor R$ ${valor.toLocaleString("pt-BR")}. Configure ANTHROPIC_API_KEY para receber análise real via Claude Sonnet 4.6.`,
    pontosCriticos: [
      { titulo: "Modo demonstração", descricao: "Configure ANTHROPIC_API_KEY no servidor para análise real.", severidade: "baixa" },
    ],
    checklistGestao: [{ item: "Configurar a chave da API Anthropic no Vercel", concluido: false }],
    janelasCriticas: doc.vigenciaFim
      ? [{ evento: "Vencimento da vigência", prazo: doc.vigenciaFim.toLocaleDateString("pt-BR"), recomendacao: "Avalie prorrogação/renovação com 90 dias de antecedência." }]
      : [],
  };
}

export async function analisarContratoIA(contrato: ContratoEntrada): Promise<AnaliseJuridica> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return analiseMock(contrato);
  }

  const valorTotal = contrato.itens.reduce((s, i) => s + i.valorTotal, 0);
  const userMessage = `Analise este contrato administrativo da perspectiva da empresa fornecedora.

CONTRATO Nº ${contrato.numero}
Tipo: ${contrato.tipo}
Procedimento: ${contrato.procedimentoSelecao}
Órgão: ${contrato.orgaoNome}
Objeto: ${contrato.objeto}

Datas e prazos:
- Assinado em: ${contrato.dataAssinatura.toLocaleDateString("pt-BR")}
- Vigência: ${contrato.vigenciaInicio.toLocaleDateString("pt-BR")} → ${contrato.vigenciaFim.toLocaleDateString("pt-BR")}
- Prazo de entrega: ${contrato.prazoEntregaDias ?? "não informado"} dias
- Prazo de pagamento: ${contrato.prazoPagamentoDias ?? "não informado"} dias
- Modalidade de entrega: ${contrato.modalidadeEntrega}
- Marco inicial do prazo: ${contrato.marcoInicialPrazo ?? "não informado"}

Valor total: R$ ${valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
Itens: ${contrato.itens.length} item(ns)

Entregue a análise estruturada conforme schema.`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") throw new Error("Resposta vazia da IA.");
  return JSON.parse(block.text) as AnaliseJuridica;
}

function analiseMock(contrato: ContratoEntrada): AnaliseJuridica {
  const valor = contrato.itens.reduce((s, i) => s + i.valorTotal, 0);
  return {
    resumoExecutivo: `[MODO DEMO] Contrato ${contrato.numero} — ${contrato.objeto.slice(0, 100)}. Valor R$ ${valor.toLocaleString("pt-BR")}. Configure ANTHROPIC_API_KEY para análise real via Claude Haiku 4.5.`,
    pontosCriticos: [
      {
        titulo: "Modo demonstração",
        descricao: "Este conteúdo é exemplificativo. Configure ANTHROPIC_API_KEY no servidor para receber a análise jurídica real do contrato pela IA da Contratos Públicos.",
        severidade: "baixa",
      },
    ],
    checklistGestao: [
      { item: "Confirmar recebimento da ordem de fornecimento", concluido: false },
      { item: "Acompanhar prazo de entrega contratual", concluido: false },
      { item: "Emitir nota fiscal e remeter ao fiscal do contrato", concluido: false },
    ],
    janelasCriticas: [
      {
        evento: "Vencimento da vigência",
        prazo: contrato.vigenciaFim.toLocaleDateString("pt-BR"),
        recomendacao: "Avalie repactuação, prorrogação ou nova licitação com 90 dias de antecedência.",
      },
    ],
  };
}
