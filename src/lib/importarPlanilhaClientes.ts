import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { normalizarCnpj } from "@/lib/validators";

/**
 * Importacao da planilha de clientes do analista (ideia da Regina, 10/08).
 *
 * O analista ja tem a carteira dele numa planilha propria e nao vai redigitar
 * empresa por empresa — essa preguica e o que trava a migracao. Aqui ele sobe o
 * arquivo do jeito que ele mantem, e a IA descobre o que cada coluna significa.
 *
 * Nao existe "formato esperado": cada analista nomeia as colunas do seu jeito
 * ("Empresa", "Cliente", "Razao Social", "NOME DA EMPRESA"), inverte a ordem,
 * usa duas linhas de cabecalho ou deixa a primeira linha como titulo. Por isso a
 * leitura vai crua pra IA em vez de tentar casar nomes de coluna no codigo.
 *
 * O que a IA NAO faz: inventar dado que nao esta na planilha. Campo ausente
 * volta null e vira pergunta pro analista — melhor perguntar do que cadastrar
 * CNPJ errado, que depois contamina cobranca e nota fiscal.
 */

export type ClienteImportado = {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  responsavel: string | null;
  email: string | null;
  telefone: string | null;
  /** Linha da planilha de onde veio (1-based), pra o analista conferir. */
  linha: number;
  /** O que a IA nao conseguiu resolver sozinha nesta linha. */
  pendencias: string[];
};

export type ResultadoImportacao = {
  clientes: ClienteImportado[];
  /** Duvidas gerais sobre a planilha (ex: coluna ambigua). */
  perguntas: string[];
  /** Como a IA interpretou cada coluna — o analista confere antes de confirmar. */
  colunasInterpretadas: Record<string, string>;
};

const MAX_LINHAS = 300;

/** Le xlsx/xls/csv e devolve a grade crua, sem supor cabecalho. */
export function lerPlanilha(buffer: Buffer): string[][] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const primeira = wb.SheetNames[0];
  if (!primeira) throw new Error("A planilha não tem nenhuma aba.");
  const sheet = wb.Sheets[primeira];
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
raw: false,
  });
  return linhas
    .map((l) => (Array.isArray(l) ? l.map((c) => String(c ?? "").trim()) : []))
    .filter((l) => l.some((c) => c !== ""));
}

function paraTexto(grade: string[][]): string {
  // Numera a linha pra IA poder apontar de onde tirou cada cliente, e o
  // analista conseguir conferir contra o arquivo original.
  return grade
    .slice(0, MAX_LINHAS)
    .map((l, i) => `${i + 1}: ${l.join(" | ")}`)
    .join("\n");
}

const SISTEMA = `Você recebe o conteúdo bruto de uma planilha de clientes mantida por um analista de licitações brasileiro. Cada analista organiza do seu jeito: nomes de coluna variam, pode haver linhas de título, subtotais, células mescladas ou colunas em branco.

Sua tarefa é identificar as EMPRESAS CLIENTES listadas e devolver os dados de cada uma.

Regras:
- Extraia apenas linhas que representem uma empresa cliente. Ignore cabeçalhos, títulos, totais, notas de rodapé e linhas vazias.
- NUNCA invente dado. Se um campo não está na planilha, devolva null.
- CNPJ: devolva só os dígitos. Se estiver claramente incompleto ou inválido, devolva null e registre em "pendencias".
- razaoSocial é obrigatório — se a linha não tem nome de empresa identificável, não a inclua.
- Em "pendencias" de cada cliente, liste o que ficou faltando ou ambíguo, em português, de forma curta e direta ("CNPJ não informado", "telefone com formato inválido").
- Em "perguntas", coloque dúvidas sobre a planilha como um todo que o analista precisaria responder ("A coluna 'Resp.' é o responsável da empresa ou o analista responsável?"). Máximo 5, só o que for realmente ambíguo.
- Em "colunasInterpretadas", diga o que você entendeu de cada coluna relevante, no formato {"coluna B": "razão social"}.

Responda SOMENTE com JSON válido no formato:
{"clientes":[{"razaoSocial":"","nomeFantasia":null,"cnpj":null,"responsavel":null,"email":null,"telefone":null,"linha":1,"pendencias":[]}],"perguntas":[],"colunasInterpretadas":{}}`;

export async function interpretarPlanilha(grade: string[][]): Promise<ResultadoImportacao> {
  if (grade.length === 0) throw new Error("A planilha está vazia.");
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const anthropic = new Anthropic({ apiKey: chave });
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8000,
    system: SISTEMA,
    messages: [{ role: "user", content: paraTexto(grade) }],
  });

  const bruto = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // A IA as vezes embrulha em ```json — pega do primeiro { ao ultimo }.
  const ini = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (ini < 0 || fim < 0) throw new Error("A IA não devolveu um resultado legível.");

  let dados: ResultadoImportacao;
  try {
    dados = JSON.parse(bruto.slice(ini, fim + 1)) as ResultadoImportacao;
  } catch {
    throw new Error("A IA devolveu um resultado inválido. Tente novamente.");
  }

  // Normaliza e revalida do lado do servidor: nao se confia no CNPJ que a IA
  // devolveu sem conferir os digitos.
  const clientes = (dados.clientes ?? [])
    .filter((c) => c && typeof c.razaoSocial === "string" && c.razaoSocial.trim())
    .map((c) => {
      const pendencias = Array.isArray(c.pendencias) ? [...c.pendencias] : [];
      let cnpj: string | null = null;
      if (c.cnpj) {
        const so = normalizarCnpj(String(c.cnpj));
        if (so.length === 14) cnpj = so;
        else pendencias.push("CNPJ incompleto na planilha");
      }
      return {
        razaoSocial: c.razaoSocial.trim(),
        nomeFantasia: c.nomeFantasia?.trim() || null,
        cnpj,
        responsavel: c.responsavel?.trim() || null,
        email: c.email?.trim().toLowerCase() || null,
        telefone: c.telefone ? String(c.telefone).replace(/\D/g, "") || null : null,
        linha: Number(c.linha) || 0,
        pendencias,
      };
    });

  return {
    clientes,
    perguntas: Array.isArray(dados.perguntas) ? dados.perguntas.slice(0, 5) : [],
    colunasInterpretadas: dados.colunasInterpretadas ?? {},
  };
}
