import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * ESP-005 RN04: minuta de contestação de glosa, gerada a partir da glosa,
 * do regime legal e dos dados do contrato. Reaproveita o modelo e o tom da
 * IA jurídica (parecer); o texto volta editável para a pessoa ajustar.
 */

export type EntradaMinuta = {
  empresa: string;
  contratoNumero: string;
  orgao: string;
  objeto: string;
  regimeLegal: string; // rótulo ("Lei 8.666/1993", "Lei 14.133/2021"...)
  competencia: string; // "outubro/2026"
  valorPrevisto: number;
  glosa: { data: string; tipo: string; valor: number; motivo: string; item: string | null; status: string };
  observacoes?: string | null;
};

const SYSTEM = `Você é advogado especialista em Direito Administrativo brasileiro, atuando para a EMPRESA CONTRATADA em contratos de terceirização com dedicação exclusiva de mão de obra. Redige peças claras, objetivas e respeitosas, com fundamentação precisa.

Ao contestar uma glosa, use:
- Lei 14.133/2021: art. 115 (regras do contrato), art. 117 (fiscalização), art. 137 e seguintes (extinção e sanções só com processo), art. 155-158 (infrações e processo de responsabilização com contraditório), art. 144 (remuneração variável vinculada a desempenho exige critérios objetivos previstos no edital/contrato), art. 141 (pagamento).
- Lei 8.666/1993, quando for o regime: art. 66 e 67 (execução e fiscalização), art. 77-78 (inexecução), art. 86-87 (sanções com defesa prévia), art. 55 (cláusulas necessárias).
- IN SEGES/MP 5/2017: Anexo V-B e VIII-A (IMR deve ter indicadores, metas e faixas previamente fixados; ajuste de pagamento é proporcional e não se confunde com sanção) e o dever de comunicação prévia à contratada.
- Constituição, art. 5º, LIV e LV (devido processo, contraditório e ampla defesa) e Lei 9.784/1999 (motivação dos atos, art. 2º e 50).
Regras: NÃO invente fatos, números de cláusulas do contrato nem datas que não foram informados — onde faltar, use um marcador entre colchetes, ex.: [cláusula X] ou [data]. Cite só o regime informado (não misture 8.666 com 14.133, salvo para mencionar que a IN 5/2017 se aplica a ambos quando couber). Seja proporcional: se a glosa parece devida, a peça pede revisão parcial e justificativa, não nega o óbvio.`;

export async function gerarMinutaContestacao(e: EntradaMinuta): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") return minutaMock(e);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const prompt = [
    `Redija a MINUTA DE CONTESTAÇÃO DE GLOSA, em português formal, pronta para a empresa revisar e protocolar junto ao fiscal/gestor do contrato.`,
    "",
    `Empresa contratada: ${e.empresa}`,
    `Contrato: ${e.contratoNumero} · Órgão: ${e.orgao}`,
    `Objeto: ${e.objeto}`,
    `Regime legal do contrato: ${e.regimeLegal}`,
    `Competência: ${e.competencia} · valor mensal previsto ${brl(e.valorPrevisto)}`,
    `Glosa: ${e.glosa.tipo}${e.glosa.item ? ` · posto/função: ${e.glosa.item}` : ""} · data ${e.glosa.data} · valor ${brl(e.glosa.valor)} · situação atual: ${e.glosa.status}`,
    `Motivo informado pelo órgão / registrado pela empresa: ${e.glosa.motivo}`,
    e.observacoes ? `Observações da empresa: ${e.observacoes}` : "",
    "",
    "Estrutura: cabeçalho (Ao Fiscal/Gestor do Contrato nº …), assunto, breve relato dos fatos, fundamentos (regime legal, IN 5/2017 quando couber, contraditório e proporcionalidade), pedido (revisão/estorno total ou parcial, com prazo razoável de resposta e pedido de acesso aos registros que embasaram a glosa), documentos que a empresa anexa (lista com marcadores), fecho com local, data e assinatura entre colchetes. Texto corrido em parágrafos numerados onde ajudar; sem markdown, sem títulos em caixa alta exagerada.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 6000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });
  const texto = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!texto) throw new Error("A IA não devolveu texto.");
  return texto;
}

function minutaMock(e: EntradaMinuta): string {
  return [
    `Ao Fiscal do Contrato nº ${e.contratoNumero} — ${e.orgao}`,
    "",
    `Assunto: Contestação de glosa — competência ${e.competencia}`,
    "",
    `1. A ${e.empresa}, contratada para ${e.objeto}, vem contestar a glosa de R$ ${e.glosa.valor.toFixed(2)} (${e.glosa.tipo}) aplicada em ${e.glosa.data}, pelo motivo: ${e.glosa.motivo}.`,
    "",
    `2. [Relato dos fatos: o que ocorreu, providências tomadas, comunicações feitas ao fiscal.]`,
    "",
    `3. Fundamentos: regime legal ${e.regimeLegal}; dever de motivação e contraditório (CF, art. 5º, LV; Lei 9.784/1999, art. 50); proporcionalidade do ajuste de pagamento (IN SEGES/MP 5/2017, Anexo V-B).`,
    "",
    `4. Pedido: revisão da glosa com estorno [total/parcial] na próxima fatura e acesso aos registros que a embasaram, no prazo de [10] dias.`,
    "",
    `Documentos anexos: [lista].`,
    "",
    `[Local], [data] — [assinatura do representante legal]`,
    "",
    "(Modo demonstração: configure ANTHROPIC_API_KEY para a minuta completa.)",
  ].join("\n");
}
