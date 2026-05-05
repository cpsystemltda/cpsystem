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
Analisa contratos administrativos da perspectiva da empresa fornecedora (que vende para o governo) e entrega:
1. Resumo executivo claro (até 4 linhas).
2. Pontos críticos para defesa estratégica (cláusulas que podem ser exploradas pela Administração contra a empresa, ou riscos contratuais).
3. Checklist de gestão (o que a empresa precisa fazer para cumprir o contrato sem ser penalizada).
4. Janelas críticas de prazo (eventos com data fixa que disparam consequência legal — vigência, reajuste, garantia, etc.).
Seja específica, jurídica, prática. Cite artigos da Lei 14.133/2021 quando aplicável.`;

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
