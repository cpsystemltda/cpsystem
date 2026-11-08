import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * ESP-006 RN09: minuta do pedido de liberação de valores da conta vinculada
 * (ou de pagamento pelo fato gerador), com a fundamentação do regime e a
 * lista de documentos. Texto volta editável.
 */

export type EntradaMinutaLiberacao = {
  empresa: string;
  contratoNumero: string;
  orgao: string;
  objeto: string;
  regimeLegal: string;
  garantia: "CONTA_VINCULADA" | "FATO_GERADOR";
  fatoGerador: string; // rótulo
  competenciaRef: string | null;
  colaboradores: string | null;
  valor: number;
  saldoEstimado: number;
  documentos: string[];
  observacoes?: string | null;
};

const SYSTEM = `Você é advogado trabalhista-administrativo da EMPRESA CONTRATADA em contrato de terceirização com dedicação exclusiva de mão de obra. Redige requerimentos formais, objetivos e bem fundamentados à Administração.

Base legal para pedidos de liberação da conta-depósito vinculada e de pagamento pelo fato gerador:
- Lei 14.133/2021, art. 121, §3º, III (conta vinculada) e V (pagamento pelo fato gerador), e §4º; art. 121, §2º (responsabilidade da Administração pelos encargos trabalhistas em caso de inadimplência quando não fiscaliza).
- IN SEGES/MP 5/2017, art. 18 e Anexo XII: a conta-depósito vinculada é bloqueada para movimentação e aberta em nome da contratada; os valores são liberados mediante comprovação da ocorrência do fato gerador (férias, 13º, rescisões) e dos pagamentos correspondentes; item 12-14 do Anexo XII tratam dos prazos e da documentação; aplicável na União/DF e também a contratos da Lei 8.666/1993; Estados e Municípios podem ter norma própria.
- Lei 8.666/1993, art. 71, §§1º e 2º, quando for o regime.
- Prazos: a Administração deve analisar o pedido em prazo razoável (a IN fala em até 20 dias para autorizar a liberação após a comprovação, quando aplicável) — se o contrato ou norma local fixar outro, prevalece.
Documentos usuais por fato gerador — Férias: aviso e recibo de férias, folha analítica, comprovante de pagamento, GFIP/eSocial do período. 13º: folha do 13º (1ª e 2ª parcelas), comprovantes de pagamento, guias de FGTS/INSS. Rescisão: TRCT, comprovante de pagamento das verbas, guia GRRF/FGTS rescisório, chave de conectividade, aviso prévio, homologação quando couber.
Regras: NÃO invente cláusulas, números de conta, datas ou nomes não informados — use marcadores entre colchetes, ex.: [cláusula], [nome do colaborador], [valor]. Cite só o regime informado. Tom respeitoso e direto.`;

export async function gerarMinutaLiberacao(e: EntradaMinutaLiberacao): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") return mock(e);
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const prompt = [
    `Redija o REQUERIMENTO DE ${e.garantia === "FATO_GERADOR" ? "PAGAMENTO DAS VERBAS PROVISIONADAS (fato gerador)" : "LIBERAÇÃO DE VALORES DA CONTA-DEPÓSITO VINCULADA"}, em português formal, pronto para a empresa revisar e protocolar.`,
    "",
    `Empresa contratada: ${e.empresa}`,
    `Contrato: ${e.contratoNumero} · Órgão: ${e.orgao}`,
    `Objeto: ${e.objeto}`,
    `Regime legal: ${e.regimeLegal}`,
    `Fato gerador: ${e.fatoGerador}${e.competenciaRef ? ` · competência de referência ${e.competenciaRef}` : ""}`,
    e.colaboradores ? `Colaboradores envolvidos: ${e.colaboradores}` : "Colaboradores envolvidos: [relacionar]",
    `Valor solicitado: ${brl(e.valor)} · saldo estimado ${e.garantia === "FATO_GERADOR" ? "provisionado" : "na conta vinculada"}: ${brl(e.saldoEstimado)}`,
    e.documentos.length ? `Documentos já anexados pela empresa: ${e.documentos.join("; ")}` : "Documentos anexados: nenhum informado ainda",
    e.observacoes ? `Observações: ${e.observacoes}` : "",
    "",
    "Estrutura: destinatário (Ao Gestor/Fiscal do Contrato nº …), assunto, qualificação da empresa, fundamentação (dispositivo do regime + IN 5/2017 quando couber), descrição do fato gerador e do valor, lista numerada dos documentos que acompanham (com os marcadores do que faltar), pedido com prazo de análise, fecho com local, data e assinatura entre colchetes. Sem markdown.",
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

function mock(e: EntradaMinutaLiberacao): string {
  return [
    `Ao Gestor do Contrato nº ${e.contratoNumero} — ${e.orgao}`,
    "",
    `Assunto: ${e.garantia === "FATO_GERADOR" ? "Pagamento de verbas provisionadas" : "Liberação de valores da conta-depósito vinculada"} — ${e.fatoGerador}${e.competenciaRef ? ` (${e.competenciaRef})` : ""}`,
    "",
    `1. A ${e.empresa} requer a liberação de R$ ${e.valor.toFixed(2)}, referente a ${e.fatoGerador.toLowerCase()} de [colaboradores], nos termos do regime ${e.regimeLegal} e da IN SEGES/MP 5/2017, art. 18 e Anexo XII.`,
    "",
    "2. Documentos que acompanham: [lista].",
    "",
    "3. Pede-se a análise no prazo de [20] dias e a transferência para a conta [dados bancários].",
    "",
    "[Local], [data] — [assinatura]",
    "",
    "(Modo demonstração: configure ANTHROPIC_API_KEY para a minuta completa.)",
  ].join("\n");
}
