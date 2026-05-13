/**
 * Helpers de diff campo-a-campo pra auditoria.
 *
 * O resumo da entrada de LogAuditoria carrega JSON com `{label, before, after}`
 * pra que o componente HistoricoLista renderize "alterou X de A para B".
 *
 * Aceita primitivas (string/number/boolean), Date e null. Outros tipos são
 * stringificados com fallback razoável.
 */

export type Mudanca = {
  campo: string;        // chave técnica (descricao, valorUnitario...)
  rotulo: string;       // label amigável ("Descrição", "Valor unitário")
  antes: unknown;       // valor original (serializável)
  depois: unknown;      // valor novo (serializável)
};

export type ResumoEdicao = {
  titulo?: string;      // contexto extra ("Item Y", "Órgão Z")
  mudancas: Mudanca[];
};

function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return v;
}

function igual(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  // Numbers com 2 casas de tolerância pra evitar 100 !== 100.0
  if (typeof na === "number" && typeof nb === "number") {
    return Math.abs(na - nb) < 0.001;
  }
  return String(na) === String(nb);
}

/**
 * Calcula mudanças entre dois snapshots (antes, depois).
 * `campos` é uma lista de chaves com seus rótulos amigáveis.
 * Só inclui chaves que efetivamente mudaram.
 */
export function calcularDiff(
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
  campos: { chave: string; rotulo: string }[],
): Mudanca[] {
  const out: Mudanca[] = [];
  for (const { chave, rotulo } of campos) {
    const a = antes[chave];
    const b = depois[chave];
    if (!igual(a, b)) {
      out.push({ campo: chave, rotulo, antes: normalize(a), depois: normalize(b) });
    }
  }
  return out;
}

/**
 * Serializa um resumo de edição em JSON pra gravar em LogAuditoria.resumo.
 * Truncado a 4 KB pra não estourar a coluna.
 */
export function serializarResumo(resumo: ResumoEdicao): string {
  const json = JSON.stringify(resumo);
  return json.length > 4000 ? json.slice(0, 3990) + '..."}' : json;
}

/**
 * Tenta parsear o resumo de volta pra um ResumoEdicao. Retorna null se não
 * for JSON válido (entradas legadas que ainda usavam string livre).
 */
export function parsearResumo(s: string | null | undefined): ResumoEdicao | null {
  if (!s) return null;
  if (!s.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(s);
    if (parsed && Array.isArray(parsed.mudancas)) return parsed as ResumoEdicao;
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Listas de campos por entidade — usadas pelo calcularDiff
// ============================================================

export const CAMPOS_ATA = [
  { chave: "numero", rotulo: "Número" },
  { chave: "processoAdministrativo", rotulo: "Processo administrativo" },
  { chave: "tipo", rotulo: "Tipo de objeto" },
  { chave: "procedimentoSelecao", rotulo: "Procedimento de seleção" },
  { chave: "numeroLicitacao", rotulo: "Nº Pregão" },
  { chave: "idAtaPncp", rotulo: "ID PNCP" },
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "orgaoNome", rotulo: "Órgão gerenciador" },
  { chave: "orgaoCnpj", rotulo: "CNPJ do órgão" },
  { chave: "orgaoEndereco", rotulo: "Endereço do órgão" },
  { chave: "orgaoEmail", rotulo: "E-mail do órgão" },
  { chave: "orgaoTelefone", rotulo: "Telefone do órgão" },
  { chave: "dataAssinatura", rotulo: "Data de assinatura" },
  { chave: "dataPublicacao", rotulo: "Data de publicação" },
  { chave: "vigenciaInicio", rotulo: "Vigência (início)" },
  { chave: "vigenciaFim", rotulo: "Vigência (fim)" },
  { chave: "prazoEntregaDias", rotulo: "Prazo de entrega" },
  { chave: "prazoEntregaNaoAplica", rotulo: "Prazo de entrega não se aplica" },
  { chave: "prazoPagamentoDias", rotulo: "Prazo de pagamento" },
  { chave: "marcoReajusteOrigem", rotulo: "Origem do marco de reajuste" },
  { chave: "marcoOrcamentoEstimado", rotulo: "Data do orçamento estimado" },
  { chave: "aceitaCarona", rotulo: "Aceita carona" },
];

export const CAMPOS_CONTRATO = [
  { chave: "numero", rotulo: "Número" },
  { chave: "numeroNotaEmpenho", rotulo: "Nota de Empenho" },
  { chave: "numeroOrdemFornecimento", rotulo: "Ordem de Fornecimento" },
  { chave: "processoAdministrativo", rotulo: "Processo administrativo" },
  { chave: "tipo", rotulo: "Tipo de objeto" },
  { chave: "procedimentoSelecao", rotulo: "Procedimento de seleção" },
  { chave: "numeroLicitacao", rotulo: "Nº Licitação" },
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "orgaoNome", rotulo: "Órgão" },
  { chave: "orgaoCnpj", rotulo: "CNPJ do órgão" },
  { chave: "orgaoEndereco", rotulo: "Endereço do órgão" },
  { chave: "orgaoEmail", rotulo: "E-mail do órgão" },
  { chave: "orgaoTelefone", rotulo: "Telefone do órgão" },
  { chave: "dataAssinatura", rotulo: "Data de assinatura" },
  { chave: "dataPublicacao", rotulo: "Data de publicação" },
  { chave: "vigenciaInicio", rotulo: "Vigência (início)" },
  { chave: "vigenciaFim", rotulo: "Vigência (fim)" },
  { chave: "prazoEntregaDias", rotulo: "Prazo de entrega" },
  { chave: "prazoPagamentoDias", rotulo: "Prazo de pagamento" },
  { chave: "marcoOrcamentoEstimado", rotulo: "Data do orçamento estimado" },
  { chave: "modalidadeEntrega", rotulo: "Modalidade de entrega" },
  { chave: "marcoInicialPrazo", rotulo: "Marco inicial do prazo" },
  { chave: "marcoInicialDescricao", rotulo: "Descrição do marco" },
  { chave: "ataId", rotulo: "Ata vinculada" },
];

export const CAMPOS_EMPENHO = [
  { chave: "instrumento", rotulo: "Instrumento contratual" },
  { chave: "numero", rotulo: "Número" },
  { chave: "numeroOrdemFornecimento", rotulo: "Ordem de Fornecimento" },
  { chave: "processoAdministrativo", rotulo: "Processo administrativo" },
  { chave: "tipo", rotulo: "Tipo de objeto" },
  { chave: "procedimentoSelecao", rotulo: "Procedimento de seleção" },
  { chave: "numeroLicitacao", rotulo: "Nº Licitação" },
  { chave: "objeto", rotulo: "Objeto" },
  { chave: "orgaoNome", rotulo: "Órgão" },
  { chave: "orgaoCnpj", rotulo: "CNPJ do órgão" },
  { chave: "orgaoEndereco", rotulo: "Endereço do órgão" },
  { chave: "orgaoEmail", rotulo: "E-mail do órgão" },
  { chave: "orgaoTelefone", rotulo: "Telefone do órgão" },
  { chave: "dataEmissao", rotulo: "Data de emissão" },
  { chave: "vigenciaInicio", rotulo: "Vigência (início)" },
  { chave: "vigenciaFim", rotulo: "Vigência (fim)" },
  { chave: "prazoEntregaDias", rotulo: "Prazo de entrega" },
  { chave: "prazoPagamentoDias", rotulo: "Prazo de pagamento" },
  { chave: "ataId", rotulo: "Ata vinculada" },
  { chave: "contratoId", rotulo: "Contrato vinculado" },
  { chave: "classificacaoOrcamentaria", rotulo: "Classificação orçamentária" },
  { chave: "signatario", rotulo: "Signatário" },
  { chave: "dataAssinatura", rotulo: "Data de assinatura" },
  { chave: "departamentoEmissor", rotulo: "Departamento emissor" },
  { chave: "pontoColeta", rotulo: "Ponto de coleta/entrega" },
  { chave: "contatoRecebedor", rotulo: "Contato do recebedor" },
  { chave: "fiscalResponsavel", rotulo: "Fiscal responsável" },
];

export const CAMPOS_ATA_ITEM = [
  { chave: "descricao", rotulo: "Descrição" },
  { chave: "unidade", rotulo: "Unidade" },
  { chave: "quantidade", rotulo: "Quantidade" },
  { chave: "marca", rotulo: "Marca" },
  { chave: "valorUnitario", rotulo: "Valor unitário" },
  { chave: "lote", rotulo: "Lote" },
  { chave: "numero", rotulo: "Número do item" },
];

export const CAMPOS_CONTRATO_ITEM = [
  { chave: "descricao", rotulo: "Descrição" },
  { chave: "unidade", rotulo: "Unidade" },
  { chave: "quantidade", rotulo: "Quantidade" },
  { chave: "marca", rotulo: "Marca" },
  { chave: "valorUnitario", rotulo: "Valor unitário" },
];

export const CAMPOS_EMPENHO_ITEM = CAMPOS_CONTRATO_ITEM;

export const CAMPOS_COMISSAO_EXECUCAO = [
  { chave: "status", rotulo: "Status da comissão" },
  { chave: "valorRecebido", rotulo: "Valor recebido" },
  { chave: "dataPagamento", rotulo: "Data do pagamento" },
  { chave: "observacao", rotulo: "Observação" },
  { chave: "percentual", rotulo: "Percentual da comissão" },
  { chave: "observacaoOverride", rotulo: "Justificativa do override" },
];

export const CAMPOS_ORGAO_NA_ATA = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "cnpj", rotulo: "CNPJ" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "limitePct", rotulo: "Limite de carona (%)" },
];

export const CAMPOS_ENDERECO_ENTREGA = [
  { chave: "rotulo", rotulo: "Rótulo" },
  { chave: "endereco", rotulo: "Endereço" },
];

export const CAMPOS_PONTO_FOCAL = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "funcao", rotulo: "Função" },
  { chave: "funcaoDescricao", rotulo: "Descrição da função" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
];
