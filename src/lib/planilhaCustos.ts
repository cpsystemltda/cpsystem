/**
 * Planilha de custos e formação de preços (ESP-003, Igor 07/11/2026).
 * Modelo IN SEGES/MP 5/2017 (Anexo VII-D): seis módulos. Funções puras;
 * valem no servidor e no cliente.
 */

export const MODULOS = [
  { codigo: "1", titulo: "Módulo 1 — Composição da remuneração" },
  { codigo: "2.1", titulo: "Módulo 2.1 — 13º salário e férias" },
  { codigo: "2.2", titulo: "Módulo 2.2 — GPS, FGTS e outras contribuições" },
  { codigo: "2.3", titulo: "Módulo 2.3 — Benefícios mensais e diários" },
  { codigo: "3", titulo: "Módulo 3 — Provisão para rescisão" },
  { codigo: "4", titulo: "Módulo 4 — Custo de reposição do profissional ausente" },
  { codigo: "5", titulo: "Módulo 5 — Insumos diversos" },
  { codigo: "6", titulo: "Módulo 6 — Custos indiretos, tributos e lucro" },
  { codigo: "OUTROS", titulo: "Outros (não mapeados — revisar)" },
] as const;
export type CodigoModulo = (typeof MODULOS)[number]["codigo"];
export const CODIGOS_MODULO = MODULOS.map((m) => m.codigo) as readonly CodigoModulo[];

export function ehModulo(s: unknown): s is CodigoModulo {
  return typeof s === "string" && (CODIGOS_MODULO as readonly string[]).includes(s);
}

export const ROTULO_ORIGEM: Record<string, string> = {
  PROPOSTA: "Proposta",
  REPACTUACAO: "Repactuação",
  REAJUSTE: "Reajuste",
  MANUAL: "Cadastro manual",
};

export type LinhaPlanilha = {
  modulo: CodigoModulo;
  descricao: string;
  percentual: number | null;
  valor: number;
  aRevisar?: boolean;
};

/** Linhas-padrão do modelo da IN 5/2017 para o cadastro manual (RN08). */
export function templateLinhas(): LinhaPlanilha[] {
  const l = (modulo: CodigoModulo, descricao: string, percentual: number | null = null): LinhaPlanilha => ({
    modulo,
    descricao,
    percentual,
    valor: 0,
  });
  return [
    l("1", "Salário-base"),
    l("1", "Adicional de periculosidade"),
    l("1", "Adicional de insalubridade"),
    l("1", "Adicional noturno"),
    l("2.1", "13º (décimo terceiro) salário", 8.33),
    l("2.1", "Férias e adicional de 1/3", 12.1),
    l("2.2", "INSS", 20),
    l("2.2", "Salário-educação", 2.5),
    l("2.2", "SAT (RAT × FAP)", 3),
    l("2.2", "SESC ou SESI", 1.5),
    l("2.2", "SENAC ou SENAI", 1),
    l("2.2", "SEBRAE", 0.6),
    l("2.2", "INCRA", 0.2),
    l("2.2", "FGTS", 8),
    l("2.3", "Transporte"),
    l("2.3", "Auxílio-alimentação"),
    l("2.3", "Assistência médica e familiar"),
    l("2.3", "Seguro de vida"),
    l("3", "Aviso prévio indenizado"),
    l("3", "Incidência do FGTS sobre o aviso prévio indenizado"),
    l("3", "Multa do FGTS e contribuição social sobre o aviso prévio indenizado"),
    l("3", "Aviso prévio trabalhado"),
    l("3", "Incidência dos encargos do submódulo 2.2 sobre o aviso prévio trabalhado"),
    l("3", "Multa do FGTS e contribuição social sobre o aviso prévio trabalhado"),
    l("4", "Ausências legais"),
    l("4", "Licença-paternidade"),
    l("4", "Ausência por acidente de trabalho"),
    l("4", "Afastamento maternidade"),
    l("4", "Intervalo intrajornada"),
    l("5", "Uniformes"),
    l("5", "Materiais"),
    l("5", "Equipamentos"),
    l("6", "Custos indiretos"),
    l("6", "Lucro"),
    l("6", "Tributos (PIS, COFINS, ISS)"),
  ];
}

export function totalDasLinhas(linhas: { valor: number }[]): number {
  return Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100;
}

export function subtotalPorModulo(linhas: LinhaPlanilha[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of linhas) out[l.modulo] = Math.round(((out[l.modulo] ?? 0) + (Number(l.valor) || 0)) * 100) / 100;
  return out;
}

/** RN04: diferença entre o total da planilha e o valor mensal do item; > R$ 0,05 pede justificativa. */
export const TOLERANCIA_DIVERGENCIA = 0.05;
export function divergencia(totalPlanilha: number, valorMensalItem: number | null | undefined): number | null {
  if (valorMensalItem == null) return null;
  return Math.round((totalPlanilha - valorMensalItem) * 100) / 100;
}
export function divergente(totalPlanilha: number, valorMensalItem: number | null | undefined): boolean {
  const d = divergencia(totalPlanilha, valorMensalItem);
  return d != null && Math.abs(d) > TOLERANCIA_DIVERGENCIA;
}

/**
 * RN07: dados que as outras ESPs consomem — salário-base, percentuais de
 * provisão (conta vinculada, ESP-006), insumos e módulo 6 (componentes do
 * preço, ESP-013/014). Heurística por descrição; quando não acha, vem null
 * e a tela pede confirmação.
 */
export type DerivadosPlanilha = {
  salarioBase: number | null;
  remuneracao: number; // soma do módulo 1
  pct13: number | null;
  pctFerias: number | null;
  pctMultaFgts: number | null;
  pctIncidencia22: number | null; // soma dos percentuais do submódulo 2.2
  insumos: number; // soma do módulo 5
  pctCustosIndiretos: number | null;
  pctLucro: number | null;
  pctTributos: number | null;
  totalMaoDeObra: number; // módulos 1 a 4
  totalModulo6: number;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function derivadosDaPlanilha(linhas: LinhaPlanilha[]): DerivadosPlanilha {
  const m = (c: CodigoModulo) => linhas.filter((l) => l.modulo === c);
  const acha = (ls: LinhaPlanilha[], re: RegExp) => ls.find((l) => re.test(norm(l.descricao)));
  const somaValor = (ls: LinhaPlanilha[]) => Math.round(ls.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100;
  const somaPct = (ls: LinhaPlanilha[]) => {
    const ps = ls.map((l) => l.percentual).filter((p): p is number => typeof p === "number");
    return ps.length ? Math.round(ps.reduce((s, p) => s + p, 0) * 100) / 100 : null;
  };
  const m1 = m("1");
  const salario = acha(m1, /salario[- ]?base|salario normativo|piso|remuneracao/);
  const m6 = m("6");
  const trib = m6.filter((l) => /pis|cofins|iss|tribut|imposto|csll|irpj/.test(norm(l.descricao)));
  return {
    salarioBase: salario ? Number(salario.valor) || null : m1[0] ? Number(m1[0].valor) || null : null,
    remuneracao: somaValor(m1),
    pct13: acha(m("2.1"), /13|decimo/)?.percentual ?? null,
    pctFerias: acha(m("2.1"), /ferias/)?.percentual ?? null,
    pctMultaFgts: acha(m("3"), /multa.*fgts/)?.percentual ?? null,
    pctIncidencia22: somaPct(m("2.2")),
    insumos: somaValor(m("5")),
    pctCustosIndiretos: acha(m6, /indireto|administra/)?.percentual ?? null,
    pctLucro: acha(m6, /lucro/)?.percentual ?? null,
    pctTributos: trib.length ? somaPct(trib) : null,
    totalMaoDeObra: somaValor([...m1, ...m("2.1"), ...m("2.2"), ...m("2.3"), ...m("3"), ...m("4")]),
    totalModulo6: somaValor(m6),
  };
}

/** Planilha como a aba recebe do servidor (datas em ISO). */
export type PlanilhaDto = {
  id: string;
  contratoItemId: string | null;
  funcao: string;
  versao: number;
  dataEfeito: string;
  origem: string;
  origemRef: string | null;
  cct: string | null;
  totalMensal: number;
  justificativaDivergencia: string | null;
  mapeamentoARevisar: boolean;
  arquivoUrl: string | null;
  criadoEm: string;
  linhas: (LinhaPlanilha & { id: string })[];
};

/** Item (função/posto) do contrato, com o valor mensal unitário que a planilha deve bater (RN04). */
export type ItemFuncao = {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  /** Pertence à vigência atual. */
  atual: boolean;
};

/** Dados prontos para exportar (XLSX/PDF) — montados no servidor. */
export type DadosExportPlanilha = {
  contratoNumero: string;
  orgao: string;
  empresa: string;
  funcao: string;
  itemDescricao: string | null;
  valorMensalItem: number | null;
  versao: number;
  dataEfeito: string; // dd/mm/aaaa
  origem: string;
  origemRef: string | null;
  cct: string | null;
  totalMensal: number;
  justificativaDivergencia: string | null;
  mapeamentoARevisar: boolean;
  linhas: LinhaPlanilha[];
  geradoEm: string; // dd/mm/aaaa
};

export function dataBr(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export function slugFuncao(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Sugere o item (função) do contrato para uma planilha, pela descrição. */
export function sugerirItemParaFuncao<T extends { id: string; descricao: string }>(funcao: string, itens: T[]): T | null {
  const tok = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const a = tok(funcao);
  let melhor: { item: T; score: number } | null = null;
  for (const it of itens) {
    const b = tok(it.descricao);
    const inter = [...a].filter((t) => b.has(t)).length;
    const uni = new Set([...a, ...b]).size || 1;
    const score = inter / uni;
    if (!melhor || score > melhor.score) melhor = { item: it, score };
  }
  return melhor && melhor.score >= 0.34 ? melhor.item : null;
}
